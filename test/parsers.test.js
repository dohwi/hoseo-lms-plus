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
