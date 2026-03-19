const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://learn.hoseo.ac.kr/' });
global.window = dom.window;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.Node = dom.window.Node;

const core = require('../lib/core.js');
global.HoseoLmsPlusCore = core;
global.HoseoLmsPlusParsers = require('../lib/parsers.js');
const dataService = require('../lib/data-service.js');

function createResponse(body, url) {
    return {
        ok: true,
        url: url,
        text: async function () {
            return body;
        }
    };
}

test('data service keeps passive resources neutral and matches watched videos more flexibly', async function () {
    const attendanceHtml = [
        '<html><head><title>테스트 강의 학습관리시스템(LMS)</title></head><body>',
        '<div id="modal-coursemos-sections"><div class="section-item"><a title="2주차 [03.10~03.16]"></a></div></div>',
        '<div class="local-ubonattend"><table class="table-coursemos"><tbody>',
        '<tr><td>2</td><td><a href="/mod/page/view.php?id=301">OT 영상</a></td><td>10분</td><td>-</td><td>10분</td><td>완료</td><td>-</td></tr>',
        '</tbody></table></div>',
        '</body></html>'
    ].join('');

    const assignHtml = '<html><body><table class="generaltable"><tbody></tbody></table></body></html>';
    const quizHtml = '<html><body><table class="generaltable"><tbody></tbody></table></body></html>';
    const courseViewHtml = [
        '<html><body>',
        '<li class="section main">',
        '<h3 class="sectionname">2주차 [03.10~03.16]</h3>',
        '<ul>',
        '<li class="activity">',
        '<img class="activityicon" alt="Page">',
        '<a class="aalink" href="/mod/page/view.php?id=301"><span>OT 영상 (1차시)</span></a>',
        '</li>',
        '<li class="activity">',
        '<img class="activityicon" alt="File">',
        '<a class="aalink" href="/mod/resource/view.php?id=401"><span>강의계획서</span></a>',
        '<span class="badge-completion" title="완료하지 않음"></span>',
        '</li>',
        '</ul>',
        '</li>',
        '<li class="section main">',
        '<h3 class="sectionname">공지사항</h3>',
        '<ul>',
        '<li class="activity">',
        '<img class="activityicon" alt="URL">',
        '<a class="aalink" href="/mod/url/view.php?id=501"><span>강의 안내 링크</span></a>',
        '</li>',
        '</ul>',
        '</li>',
        '</body></html>'
    ].join('');

    global.fetch = async function (url) {
        if (url.includes('/local/ubonattend/my_status.php')) return createResponse(attendanceHtml, url);
        if (url.includes('/mod/assign/index.php')) return createResponse(assignHtml, url);
        if (url.includes('/mod/quiz/index.php')) return createResponse(quizHtml, url);
        if (url.includes('/course/view.php')) return createResponse(courseViewHtml, url);
        throw new Error('Unexpected URL: ' + url);
    };

    const service = dataService.create({
        getRequestQueue: function () {
            return {
                enqueue: function (task) {
                    return task({});
                }
            };
        }
    });

    const result = await service.fetchAllCourseData(['101']);
    const video = result.allActivities.find((item) => item.type === 'Page');
    const file = result.allActivities.find((item) => item.type === 'File');
    const otherWeekUrl = result.allActivities.find((item) => item.weekNum === core.OTHER_WEEK_NUM);

    assert.equal(Boolean(video), true);
    assert.equal(video.isCompleted, true);
    assert.equal(video.isNeutral, false);
    assert.match(video.statusText, /완료/);

    assert.equal(Boolean(file), true);
    assert.equal(file.isNeutral, true);
    assert.equal(file.statusText, '-');

    assert.equal(otherWeekUrl, undefined);
});
