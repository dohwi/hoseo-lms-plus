const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const core = require('../lib/core.js');
global.Node = new JSDOM('<!doctype html><html><body></body></html>').window.Node;

global.HoseoLmsPlusCore = core;
const ui = require('../lib/ui.js');

test('buildHostMount preserves host layout and restoreHost restores original content', function () {
    const dom = new JSDOM('<!doctype html><html><body><main id="page-main"><div class="original">원본 내용</div></main></body></html>');
    const doc = dom.window.document;
    const host = doc.querySelector('main');

    const result = ui.buildHostMount(doc);

    assert.equal(result.host, host);
    assert.equal(host.querySelector('.original'), null);
    assert.equal(host.firstElementChild.id, core.SELECTORS.dashboardMountId);

    ui.restoreHost(host, result.mount);

    assert.equal(host.querySelector('.original').textContent, '원본 내용');
    assert.equal(doc.getElementById(core.SELECTORS.dashboardMountId), null);
});

test('renderDashboard uses svg icon buttons for header controls', function () {
    const dom = new JSDOM('<!doctype html><html><body><section id="mount"></section></body></html>');
    const doc = dom.window.document;
    const mount = doc.getElementById('mount');

    ui.renderDashboard(doc, mount, {
        week: 4,
        periodStr: '[3월24일 - 3월30일]',
        activities: [],
        incActivities: [],
        courseNames: [],
        warnings: [],
        canPrev: true,
        canNext: true,
        baseUrl: core.DEFAULT_BASE_URL,
        handlers: {
            onPrev: function () {},
            onNext: function () {},
            onRefresh: function () {}
        }
    });

    const prevIcon = doc.querySelector('#dash-prev-btn svg.lms-icon-arrow');
    const nextIcon = doc.querySelector('#dash-next-btn svg.lms-icon-arrow');
    const refreshIcon = doc.querySelector('#lms-refresh-btn svg.lms-icon-refresh');

    assert.ok(prevIcon);
    assert.ok(nextIcon);
    assert.ok(refreshIcon);
    assert.equal(prevIcon.namespaceURI, 'http://www.w3.org/2000/svg');
    assert.equal(nextIcon.querySelector('path').namespaceURI, 'http://www.w3.org/2000/svg');
    assert.equal(refreshIcon.querySelectorAll('path').length, 2);
    assert.ok(doc.querySelector('#lms-info-btn svg.lms-icon-info'));
    assert.equal(doc.getElementById('dash-prev-btn').getAttribute('title'), '이전 주차');
    assert.equal(doc.getElementById('dash-next-btn').getAttribute('title'), '다음 주차');
    assert.equal(doc.getElementById('lms-refresh-btn').getAttribute('title'), '새로고침');
    assert.equal(doc.getElementById('lms-info-btn').getAttribute('title'), null);
});

test('renderDashboard shows default period text for 기타 week', function () {
    const dom = new JSDOM('<!doctype html><html><body><section id="mount"></section></body></html>');
    const doc = dom.window.document;
    const mount = doc.getElementById('mount');

    ui.renderDashboard(doc, mount, {
        week: core.OTHER_WEEK_NUM,
        periodStr: '',
        activities: [],
        incActivities: [],
        courseNames: [],
        warnings: [],
        canPrev: true,
        canNext: true,
        baseUrl: core.DEFAULT_BASE_URL,
        handlers: {
            onPrev: function () {},
            onNext: function () {},
            onRefresh: function () {}
        }
    });

    assert.equal(doc.querySelector('.lms-week-title-large').textContent, '기타');
    assert.equal(doc.querySelector('.lms-week-period').textContent, '[MOOC 등 기타 강의]');
});

test('renderDashboard treats 7-day remaining tasks as urgent', function () {
    const dom = new JSDOM('<!doctype html><html><body><section id="mount"></section></body></html>');
    const doc = dom.window.document;
    const mount = doc.getElementById('mount');
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const dueDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 0, 0, 0);
    const startYyyy = String(startDate.getFullYear());
    const startMm = String(startDate.getMonth() + 1).padStart(2, '0');
    const startDd = String(startDate.getDate()).padStart(2, '0');
    const yyyy = String(dueDate.getFullYear());
    const mm = String(dueDate.getMonth() + 1).padStart(2, '0');
    const dd = String(dueDate.getDate()).padStart(2, '0');

    ui.renderDashboard(doc, mount, {
        week: 4,
        periodStr: '[3월24일 - 3월30일]',
        activities: [],
        incActivities: [{
            courseId: '101',
            courseName: '테스트 강의',
            weekNum: 4,
            periodStr: '[3월24일 - 3월30일]',
            type: '과제',
            href: '/mod/assign/view.php?id=1',
            nameHtml: '<span>긴급 과제</span>',
            optionsHtml: startYyyy + '-' + startMm + '-' + startDd + ' 00:00:00 ~ ' + yyyy + '-' + mm + '-' + dd + ' 23:59:59',
            statusText: '미제출',
            isCompleted: false,
            isNeutral: false
        }],
        courseNames: [],
        warnings: [],
        canPrev: true,
        canNext: true,
        baseUrl: core.DEFAULT_BASE_URL,
        handlers: {
            onPrev: function () {},
            onNext: function () {},
            onRefresh: function () {}
        }
    });

    assert.equal(doc.querySelector('.lms-row-urgent') !== null, true);
});

test('renderDashboard uses yellow warning rows for non-urgent incomplete items', function () {
    const dom = new JSDOM('<!doctype html><html><body><section id="mount"></section></body></html>');
    const doc = dom.window.document;
    const mount = doc.getElementById('mount');
    const now = new Date();
    const dueDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 12, 0, 0, 0);
    const yyyy = String(dueDate.getFullYear());
    const mm = String(dueDate.getMonth() + 1).padStart(2, '0');
    const dd = String(dueDate.getDate()).padStart(2, '0');

    ui.renderDashboard(doc, mount, {
        week: 4,
        periodStr: '[3월24일 - 3월30일]',
        activities: [],
        incActivities: [{
            courseId: '101',
            courseName: '테스트 강의',
            weekNum: 4,
            periodStr: '[3월24일 - 3월30일]',
            type: '과제',
            href: '/mod/assign/view.php?id=2',
            nameHtml: '<span>일반 미완료 과제</span>',
            optionsHtml: yyyy + '-' + mm + '-' + dd + ' 00:00:00 ~ ' + yyyy + '-' + mm + '-' + dd + ' 23:59:59',
            statusText: '미제출',
            isCompleted: false,
            isNeutral: false
        }],
        courseNames: [],
        warnings: [],
        canPrev: true,
        canNext: true,
        baseUrl: core.DEFAULT_BASE_URL,
        handlers: {
            onPrev: function () {},
            onNext: function () {},
            onRefresh: function () {}
        }
    });

    assert.equal(doc.querySelector('.lms-row-warning') !== null, true);
    assert.equal(doc.querySelector('.lms-row-neutral') === null, true);
});

test('renderDashboard includes info tooltip with status criteria', function () {
    const dom = new JSDOM('<!doctype html><html><body><section id="mount"></section></body></html>');
    const doc = dom.window.document;
    const mount = doc.getElementById('mount');

    ui.renderDashboard(doc, mount, {
        week: 4,
        periodStr: '[3월24일 - 3월30일]',
        activities: [],
        incActivities: [],
        courseNames: [],
        warnings: [],
        canPrev: true,
        canNext: true,
        baseUrl: core.DEFAULT_BASE_URL,
        handlers: {
            onPrev: function () {},
            onNext: function () {},
            onRefresh: function () {}
        }
    });

    const tooltip = doc.querySelector('.lms-info-tooltip');
    assert.ok(tooltip);
    assert.match(tooltip.textContent, /표기 기준/);
    assert.match(tooltip.textContent, /7일 이하/);
    assert.match(tooltip.textContent, /아직 시작 기간이 되지 않은 항목/);
    assert.match(tooltip.textContent, /시작 기간은 지났지만 마감까지 8일 이상 남은 미완료 항목/);
    assert.match(tooltip.textContent, /상태 확인 대상이 아닌 항목/);
    assert.equal(doc.querySelectorAll('.lms-info-tooltip-badge').length, 5);
    assert.match(tooltip.textContent, /판정 기준 상세/);
    assert.match(tooltip.textContent, /출석\/학습 현황 페이지/);
    assert.match(tooltip.textContent, /과제함, 퀴즈 목록, 상세 페이지/);
    assert.match(tooltip.textContent, /시작일이 오늘 이후/);
});

test('renderDashboard renders footer disclaimer text', function () {
    const dom = new JSDOM('<!doctype html><html><body><section id="mount"></section></body></html>');
    const doc = dom.window.document;
    const mount = doc.getElementById('mount');

    ui.renderDashboard(doc, mount, {
        week: 4,
        periodStr: '[3월24일 - 3월30일]',
        activities: [],
        incActivities: [],
        courseNames: [],
        warnings: [],
        canPrev: true,
        canNext: true,
        baseUrl: core.DEFAULT_BASE_URL,
        handlers: {
            onPrev: function () {},
            onNext: function () {},
            onRefresh: function () {}
        }
    });

    const footer = doc.querySelector('.lms-dashboard-footer-text');
    const footerLink = doc.querySelector('.lms-dashboard-footer-link');
    const footerLines = doc.querySelectorAll('.lms-dashboard-footer-line');
    assert.ok(footer);
    assert.equal(footerLines.length, 2);
    assert.match(footerLines[0].textContent, /모든 책임은 사용자에게 있습니다/);
    assert.match(footerLines[1].textContent, /기타 문의는/);
    assert.match(footerLines[1].textContent, /me@dohwi.com/);
    assert.ok(footerLink);
    assert.equal(footerLink.getAttribute('href'), 'mailto:me@dohwi.com');
    assert.equal(footerLink.getAttribute('title'), '이메일 보내기');
});
