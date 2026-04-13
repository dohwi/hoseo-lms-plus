const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

global.DOMParser = class DOMParser {
    parseFromString(html) {
        return new JSDOM(html).window.document;
    }
};

global.Node = new JSDOM('<!doctype html><html><body></body></html>').window.Node;

require('../lib/core.js');
const parsers = require('../lib/parsers.js');

test('parseAttendancePage extracts period and completion state', function () {
    const html = `
        <html>
        <head><title>테스트 강의 학습관리시스템(LMS)</title></head>
        <body>
            <div id="modal-coursemos-sections">
                <div class="section-item"><a title="1주차 [03.01~03.07]"></a></div>
            </div>
            <div class="local-ubonattend">
                <table class="table-coursemos">
                    <tbody>
                        <tr>
                            <td>1</td><td><a href="/video">OT 영상</a></td><td>30분</td><td>-</td><td>30분</td><td>완료</td><td>-</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </body>
        </html>
    `;

    const result = parsers.parseAttendancePage(html, '101', 'https://learn.hoseo.ac.kr');
    assert.equal(result.courseName, '테스트 강의');
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].weekNum, 1);
    assert.equal(result.items[0].periodStr, '[03.01~03.07]');
    assert.equal(result.items[0].materialHref, 'https://learn.hoseo.ac.kr/video');
    assert.equal(result.items[0].isCompleted, true);
});

test('parseAssignmentIndexPage stores activity keys for matching', function () {
    const html = `
        <table class="generaltable">
            <tbody>
                <tr>
                    <td>1주 [03.01~03.07]</td>
                    <td><a href="/mod/assign/view.php?id=44">과제 1</a></td>
                    <td>2026-03-07</td>
                    <td>미제출</td>
                    <td>-</td>
                </tr>
            </tbody>
        </table>
    `;

    const result = parsers.parseAssignmentIndexPage(html, '101', '테스트 강의', { 1: '[03.01~03.07]' }, 'https://learn.hoseo.ac.kr');
    assert.equal(result.length, 1);
    assert.equal(result[0].activityKey, '/mod/assign/view.php?id=44');
});

test('parseAttendancePage handles mixed week and continuation rows fixture', function () {
    const html = fs.readFileSync(path.join(__dirname, 'fixtures', 'attendance-mixed.html'), 'utf8');
    const result = parsers.parseAttendancePage(html, '101', 'https://learn.hoseo.ac.kr');

    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].weekNum, 2);
    assert.equal(result.items[0].materialHref, 'https://learn.hoseo.ac.kr/mod/page/view.php?id=77');
    assert.equal(result.items[1].weekNum, 2);
    assert.equal(result.items[1].isCompleted, true);
});

test('parseCourseViewPage fixture extracts activity metadata and ignored types', function () {
    const html = fs.readFileSync(path.join(__dirname, 'fixtures', 'course-view-sample.html'), 'utf8');
    const result = parsers.parseCourseViewPage(html, '101', '샘플 강의', { 2: '[03.08~03.14]' }, 'https://learn.hoseo.ac.kr');

    assert.equal(result.length, 2);
    assert.equal(result[0].activityKey, '/mod/assign/view.php?id=44');
    assert.equal(result[0].completionTitle, '완료하지 않음');
    assert.equal(result[1].isIgnoredType, true);
});

test('parseQuizAttemptStatus detects completed attempts', function () {
    const result = parsers.parseQuizAttemptStatus('<div class="quizattemptsummary"><div class="statedetails">제출됨 2026-03-19</div></div>');
    assert.equal(result.isCompleted, true);
    assert.equal(result.finalStatusText.includes('제출됨'), true);
});

test('parseCourseViewPage OOP fixture extracts all 15 weeks with correct types and completion', function () {
    const html = fs.readFileSync(path.join(__dirname, 'fixtures', 'course-view-oop.html'), 'utf8');
    const periodMap = { 1: '[03.04~03.10]', 2: '[03.11~03.17]', 3: '[03.18~03.24]', 4: '[03.25~03.31]', 5: '[04.01~04.07]', 6: '[04.08~04.14]', 7: '[04.15~04.21]', 8: '[04.22~04.28]', 9: '[04.29~05.05]', 10: '[05.06~05.12]', 11: '[05.13~05.19]', 12: '[05.20~05.26]', 13: '[05.27~06.02]', 14: '[06.03~06.09]', 15: '[06.10~06.16]' };
    const result = parsers.parseCourseViewPage(html, '5001', '객체지향프로그래밍', periodMap, 'https://learn.hoseo.ac.kr');

    assert.equal(result.length, 22);

    const week1 = result.filter(function (a) { return a.weekNum === 1; });
    assert.equal(week1.length, 2);
    assert.equal(week1[0].periodStr, '[03.04~03.10]');
    assert.equal(week1[0].type, 'vod');
    assert.equal(week1[0].completionTitle, '');
    assert.equal(week1[1].completionTitle, '완료');

    const week3 = result.filter(function (a) { return a.weekNum === 3; });
    assert.equal(week3.length, 2);
    assert.equal(week3[1].type, '퀴즈');
    assert.equal(week3[1].isIgnoredType, false);

    const week7 = result.filter(function (a) { return a.weekNum === 7; });
    assert.equal(week7.length, 2);
    assert.equal(week7[1].type, '파일');
    assert.equal(week7[1].isIgnoredType, true);

    const week14 = result.filter(function (a) { return a.weekNum === 14; });
    assert.equal(week14.length, 2);
    assert.equal(week14[0].type, '동료평가');
    assert.equal(week14[1].activityKey, '/mod/assign/view.php?id=400110');

    const week15 = result.filter(function (a) { return a.weekNum === 15; });
    assert.equal(week15.length, 0);
});

test('parseAssignmentIndexPage OOP fixture extracts 14 assignments across 10 weeks', function () {
    const html = fs.readFileSync(path.join(__dirname, 'fixtures', 'assign-index-oop.html'), 'utf8');
    const result = parsers.parseAssignmentIndexPage(html, '5001', '객체지향프로그래밍', {}, 'https://learn.hoseo.ac.kr');

    assert.equal(result.length, 14);

    assert.equal(result[0].weekNum, 1);
    assert.equal(result[0].isCompleted, true);
    assert.match(result[0].gradeHtml, /10\.00 \/ 10\.00/);

    const week3 = result.filter(function (a) { return a.weekNum === 3; });
    assert.equal(week3.length, 1);
    assert.match(week3[0].titleHtml, /3주차 프로그래밍 과제/);

    const week4 = result.filter(function (a) { return a.weekNum === 4; });
    assert.equal(week4.length, 1);
    assert.equal(week4[0].isCompleted, false);
    assert.match(week4[0].submitText, /미제출/);

    const week5 = result.filter(function (a) { return a.weekNum === 5; });
    assert.equal(week5.length, 2);
    assert.equal(week5[1].activityKey, '/mod/assign/view.php?id=400015');

    const last = result[result.length - 1];
    assert.equal(last.weekNum, 13);
});

test('parseAttendancePage OOP fixture extracts 8 materials across 7 weeks with mixed completion', function () {
    const html = fs.readFileSync(path.join(__dirname, 'fixtures', 'attend-status-oop.html'), 'utf8');
    const result = parsers.parseAttendancePage(html, '5001', 'https://learn.hoseo.ac.kr');

    assert.equal(result.courseName, '객체지향프로그래밍 (05)');

    const materials = result.items;
    assert.equal(materials.length, 8);

    assert.equal(materials[0].weekNum, 1);
    assert.equal(materials[0].isCompleted, true);
    assert.equal(materials[0].periodStr, '[03.04~03.10]');

    const week2 = materials.filter(function (m) { return m.weekNum === 2; });
    assert.equal(week2.length, 2);
    assert.equal(week2[0].materialHref, 'https://learn.hoseo.ac.kr/mod/vod/view.php?id=400003');
    assert.equal(week2[1].materialHref, 'https://learn.hoseo.ac.kr/mod/vod/view.php?id=400004');

    const week3 = materials.filter(function (m) { return m.weekNum === 3; });
    assert.equal(week3.length, 1);
    assert.equal(week3[0].isCompleted, false);
    assert.match(week3[0].statusHtml, /X/);

    assert.equal(materials[7].weekNum, 7);
    assert.equal(materials[7].isCompleted, false);

    assert.equal(result.periodMap[1], '[03.04~03.10]');
    assert.equal(result.periodMap[15], '[06.10~06.16]');
});

test('parseQuizIndexPage keeps continuation rows in the same week', function () {
    const html = `
        <table class="generaltable">
            <tbody>
                <tr>
                    <td>4주차 [3월24일 - 3월30일]</td>
                    <td><a href="view.php?id=1086320">4주차_2차시_퀴즈</a></td>
                    <td>2026-04-07 00:00</td>
                    <td></td>
                </tr>
                <tr>
                    <td></td>
                    <td><a href="view.php?id=1052482">4주차 퀴즈</a></td>
                    <td>2026-03-31 12:15</td>
                    <td></td>
                </tr>
            </tbody>
        </table>
    `;

    const result = parsers.parseQuizIndexPage(html, '39456', '객체지향프로그래밍', { 4: '[3월24일 - 3월30일]' }, 'https://learn.hoseo.ac.kr');
    assert.equal(result.length, 2);
    assert.equal(result[0].weekNum, 4);
    assert.equal(result[1].weekNum, 4);
    assert.match(result[1].titleHtml, /4주차 퀴즈/);
    assert.equal(result[1].activityKey, '/mod/quiz/view.php?id=1052482');
});
