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

function createRuntime(signal, requestTimeoutMs) {
    return {
        requestTimeoutMs: requestTimeoutMs,
        getRequestQueue: function () {
            return {
                enqueue: function (task) {
                    return task(signal || new AbortController().signal);
                }
            };
        }
    };
}

function createResponse(body, url, headers) {
    return {
        ok: true,
        url: url,
        headers: { get: function (name) { return headers && headers[name.toLowerCase()] || null; } },
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
        '<img class="activityicon" alt="게시판">',
        '<a class="aalink" href="/mod/ubboard/view.php?id=1136930"><span>공지사항</span></a>',
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
        if (url.includes('/mod/ubboard/view.php?id=1136930')) {
            return createResponse('<table class="ubboard-list"><tbody><tr><td><a href="/mod/ubboard/read.php?id=1136930&amp;articleid=10">개강 공지</a></td><td>2026.03.12</td></tr></tbody></table>', url);
        }
        throw new Error('Unexpected URL: ' + url);
    };

    const service = dataService.create(createRuntime());

    const result = await service.fetchAllCourseData(['101']);
    const video = result.allActivities.find((item) => item.type === 'Page');
    const file = result.allActivities.find((item) => item.type === 'File');
    const otherWeekUrl = result.allActivities.find((item) => item.weekNum === core.OTHER_WEEK_NUM);
    const notice = result.allActivities.find((item) => item.type === '공지사항');

    assert.equal(Boolean(video), true);
    assert.equal(video.isCompleted, true);
    assert.equal(video.isNeutral, false);
    assert.match(video.statusText, /완료/);

    assert.equal(Boolean(file), true);
    assert.equal(file.isNeutral, true);
    assert.equal(file.statusText, '-');

    assert.equal(otherWeekUrl, undefined);
    assert.equal(notice.courseName, '테스트 강의');
    assert.equal(notice.weekNum, 2);
    assert.equal(notice.href, 'https://learn.hoseo.ac.kr/mod/ubboard/read.php?id=1136930&articleid=10');
    assert.equal(notice.optionsHtml, '03.12');
    assert.equal(notice.isNeutral, true);
    assert.equal(result.allActivities.filter((item) => !item.isCompleted && !item.isNeutral).includes(notice), false);
});

test('data service keeps notice-board failures as course warnings', async function () {
    const attendanceHtml = '<title>테스트 강의 학습관리시스템(LMS)</title><div id="modal-coursemos-sections"><div class="section-item"><a title="1주차 [03.01~03.07]"></a></div></div>';
    const courseViewHtml = '<ul class="weeks"><li class="section main"><h3 class="sectionname">공지사항</h3><ul><li class="activity"><img class="activityicon" alt="게시판"><a class="aalink" href="/mod/ubboard/view.php?id=1136930">공지사항</a></li></ul></li></ul>';

    global.fetch = async function (url) {
        if (url.includes('/local/ubonattend/my_status.php')) return createResponse(attendanceHtml, url);
        if (url.includes('/mod/assign/index.php') || url.includes('/mod/quiz/index.php')) return createResponse('<table class="generaltable"></table>', url);
        if (url.includes('/course/view.php')) return createResponse(courseViewHtml, url);
        if (url.includes('/mod/ubboard/view.php')) throw new Error('network error');
        throw new Error('Unexpected URL: ' + url);
    };

    const result = await dataService.create(createRuntime()).fetchAllCourseData(['101']);
    assert.equal(result.allActivities.length, 0);
    assert.equal(result.warnings.some(function (warning) { return warning.includes('테스트 강의: 테스트 강의 공지사항 요청에 실패했습니다.'); }), true);
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

    const service = dataService.create(createRuntime());

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

test('data service refuses external activity detail requests', async function () {
    const attendanceHtml = '<title>테스트 강의 학습관리시스템(LMS)</title><div id="modal-coursemos-sections"><div class="section-item"><a title="1주차 [03.01~03.07]"></a></div></div>';
    const assignHtml = '<table class="generaltable"><tbody><tr><td>1주차 [03.01~03.07]</td><td><a href="https://evil.example/steal">외부 과제</a></td><td>-</td><td>미제출</td><td>-</td></tr></tbody></table>';
    const emptyTable = '<table class="generaltable"><tbody></tbody></table>';
    const courseViewHtml = '<li class="section main"><h3 class="sectionname">1주차 [03.01~03.07]</h3><ul><li class="activity"><img class="activityicon" alt="과제"><a class="aalink" href="https://evil.example/steal"><span>외부 과제</span></a></li></ul></li>';
    const fetchedUrls = [];

    global.fetch = async function (url) {
        fetchedUrls.push(url);
        if (url.includes('/local/ubonattend/my_status.php')) return createResponse(attendanceHtml, url);
        if (url.includes('/mod/assign/index.php')) return createResponse(assignHtml, url);
        if (url.includes('/mod/quiz/index.php')) return createResponse(emptyTable, url);
        if (url.includes('/course/view.php')) return createResponse(courseViewHtml, url);
        throw new Error('Unexpected URL: ' + url);
    };

    const result = await dataService.create(createRuntime()).fetchAllCourseData([{ id: '101', isIrregular: false }]);
    assert.equal(fetchedUrls.some(function (url) { return url.startsWith('https://evil.example'); }), false);
    assert.equal(result.allActivities.length, 1);
    assert.equal(result.allActivities[0].href, '#');
    assert.equal(result.allActivities[0].isNeutral, false);
    assert.equal(result.allActivities[0].statusText, '미제출');
});

test('data service detects login forms, response limits, and memoizes duplicate URLs', async function () {
    let calls = 0;
    global.fetch = async function (url) {
        calls += 1;
        if (url.includes('/local/ubonattend/')) return createResponse('<form action="/login/index.php"><input type="password"></form>', url);
        return createResponse('', url, { 'content-length': '999' });
    };
    const result = await dataService.create(createRuntime(null, 100)).fetchAllCourseData([{ id: '101', isIrregular: false }]);
    assert.equal(result.sessionExpired, true);
    assert.equal(calls, 4);

    const service = dataService.create(createRuntime(null, 100));
    global.fetch = async function (url) { return createResponse('x'.repeat(10), url); };
    const oversized = await service.fetchAllCourseData([{ id: '102', isIrregular: false }]);
    assert.equal(oversized.warnings.every(function (warning) { return warning.includes('응답 크기가 허용 한도를 초과했습니다.'); }), true);
});

test('data service does not mistake ordinary userid forms for login', async function () {
    const ordinaryForm = '<form action="/mod/assign/view.php"><input type="hidden" name="userid" value="101"></form>';
    global.fetch = async function (url) { return createResponse(ordinaryForm, url); };
    const result = await dataService.create(createRuntime()).fetchAllCourseData([{ id: '101', isIrregular: false }]);
    assert.equal(result.sessionExpired, false);
});

test('data service fetches every incomplete assignment detail without a hard count limit', async function () {
    const attendance = '<title>강의 학습관리시스템(LMS)</title>';
    const assignments = '<table class="generaltable"><tbody>' + [1, 2, 3].map(function (id) { return '<tr><td>1주</td><td><a href="/mod/assign/view.php?id=' + id + '">과제 ' + id + '</a></td><td>2026-03-0' + id + '</td><td>미제출</td><td>-</td></tr>'; }).join('') + '</tbody></table>';
    const fetched = [];
    global.fetch = async function (url) {
        fetched.push(url);
        if (url.includes('ubonattend')) return createResponse(attendance, url);
        if (url.includes('assign/index')) return createResponse(assignments, url);
        if (url.includes('quiz/index')) return createResponse('<table class="generaltable"></table>', url);
        if (url.includes('course/view')) return createResponse('', url);
        return createResponse('', url);
    };
    const result = await dataService.create(createRuntime()).fetchAllCourseData([{ id: '101', isIrregular: false }]);
    assert.equal(fetched.filter(function (url) { return url.includes('/mod/assign/view.php'); }).length, 3);
    assert.equal(result.warnings.some(function (warning) { return warning.includes('요청 한도'); }), false);
});

test('data service reports request timeouts instead of hanging', async function () {
    global.fetch = function (_url, options) {
        return new Promise(function (_resolve, reject) {
            options.signal.addEventListener('abort', function () {
                const error = new Error('aborted');
                error.name = 'AbortError';
                reject(error);
            }, { once: true });
        });
    };

    const service = dataService.create(createRuntime(null, 5));
    const result = await service.fetchAllCourseData([{ id: '101', isIrregular: false }]);

    assert.equal(result.allActivities.length, 0);
    assert.equal(result.warnings.length, 4);
    assert.equal(result.warnings.every(function (warning) { return warning.includes('요청 시간이 초과되었습니다.'); }), true);
});

test('data service propagates queue cancellation', async function () {
    const queueController = new AbortController();
    global.fetch = function (_url, options) {
        return new Promise(function (_resolve, reject) {
            options.signal.addEventListener('abort', function () {
                const error = new Error('aborted');
                error.name = 'AbortError';
                reject(error);
            }, { once: true });
        });
    };

    const service = dataService.create(createRuntime(queueController.signal, 1000));
    const request = service.fetchAllCourseData([{ id: '101', isIrregular: false }]);
    queueController.abort();

    await assert.rejects(request, { name: 'AbortError' });
});
