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

test('data service falls back to course-wide matching when week parsing differs', async function () {
    const attendanceHtml = [
        '<html><head><title>객체지향프로그래밍 학습관리시스템(LMS)</title></head><body>',
        '<div id="modal-coursemos-sections"><div class="section-item"><a title="4주차 [3월24일 - 3월30일]"></a></div></div>',
        '<div class="local-ubonattend"><table class="table-coursemos"><tbody>',
        '<tr><td>5</td><td><a href="/mod/vod/view.php?id=1052475">4주차 동영상1</a></td><td>39:50</td><td>-</td><td>39:50</td><td>완료</td><td>-</td></tr>',
        '</tbody></table></div>',
        '</body></html>'
    ].join('');

    const assignHtml = '<html><body><table class="generaltable"><tbody></tbody></table></body></html>';
    const quizHtml = [
        '<html><body><table class="generaltable"><tbody>',
        '<tr><td>5주차 [3월31일 - 4월6일]</td><td><a href="view.php?id=1052482">4주차 퀴즈</a></td><td>2026-03-31 12:15</td><td></td></tr>',
        '</tbody></table></body></html>'
    ].join('');
    const courseViewHtml = [
        '<html><body>',
        '<li class="section main">',
        '<h3 class="sectionname">4주차 [3월24일 - 3월30일]</h3>',
        '<ul>',
        '<li class="activity">',
        '<img class="activityicon" alt="동영상">',
        '<a class="aalink" href="/mod/vod/view.php?id=1052475"><span>4주차 동영상1</span></a>',
        '</li>',
        '<li class="activity">',
        '<img class="activityicon" alt="퀴즈">',
        '<a class="aalink" href="/mod/quiz/view.php?id=1052482"><span>4주차 퀴즈</span></a>',
        '</li>',
        '</ul>',
        '</li>',
        '</body></html>'
    ].join('');
    const quizAttemptHtml = '<div class="quizattemptsummary"><div class="statedetails">미응시</div></div>';

    global.fetch = async function (url) {
        if (url.includes('/local/ubonattend/my_status.php')) return createResponse(attendanceHtml, url);
        if (url.includes('/mod/assign/index.php')) return createResponse(assignHtml, url);
        if (url.includes('/mod/quiz/index.php')) return createResponse(quizHtml, url);
        if (url.includes('/course/view.php')) return createResponse(courseViewHtml, url);
        if (url.includes('/mod/quiz/view.php?id=1052482')) return createResponse(quizAttemptHtml, url);
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

    const result = await service.fetchAllCourseData(['39456']);
    const video = result.allActivities.find((item) => item.type === '동영상');
    const quiz = result.allActivities.find((item) => item.type === '퀴즈');

    assert.equal(Boolean(video), true);
    assert.equal(video.isCompleted, true);
    assert.match(video.statusText, /완료/);

    assert.equal(Boolean(quiz), true);
    assert.equal(quiz.isCompleted, false);
    assert.equal(quiz.isNeutral, false);
    assert.equal(quiz.statusText, '미응시');
    assert.match(quiz.optionsHtml, /2026-03-31 12:15/);
});
