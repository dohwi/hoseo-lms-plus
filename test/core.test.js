const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.Node = dom.window.Node;

const core = require('../lib/core.js');

test('sanitizeHtmlToString strips unsafe attributes and protocols', function () {
    const sanitized = core.sanitizeHtmlToString(dom.window.document, '<a href="javascript:alert(1)" onclick="alert(1)">test</a><script>alert(1)</script><span>ok</span>', { baseUrl: 'https://learn.hoseo.ac.kr' });
    assert.equal(sanitized.includes('javascript:'), false);
    assert.equal(sanitized.includes('onclick'), false);
    assert.equal(sanitized.includes('<script'), false);
    assert.equal(sanitized.includes('<span>ok</span>'), true);
});

test('buildCacheKey changes with user and course ids', function () {
    const first = core.buildCacheKey({ userId: '101' }, ['3', '1']);
    const second = core.buildCacheKey({ userId: '102' }, ['1', '3']);
    const third = core.buildCacheKey({ userId: '101' }, ['1', '4']);
    assert.notEqual(first, second);
    assert.notEqual(first, third);
    assert.equal(first, core.buildCacheKey({ userId: '101' }, ['1', '3']));
});

test('getCourseIds supports fallback course selectors', function () {
    const localDom = new JSDOM('<!doctype html><html><body><div class="course-card" data-id="101"></div><div data-course-id="202"></div></body></html>');
    const ids = core.getCourseIds(localDom.window.document);
    assert.deepEqual(ids, ['101', '202']);
});

test('getCourseInfoList detects regular and irregular course types', function () {
    const localDom = new JSDOM('<!doctype html><html><body>' +
        '<div class="lists"><div class="course course-type-R" data-id="101"></div>' +
        '<div class="course course-type-CMS_ON" data-id="202"></div>' +
        '<div class="course course-type-IR" data-id="303"></div>' +
        '<div class="course course-type-R" data-id="404"></div></div>' +
    '</body></html>');
    const info = core.getCourseInfoList(localDom.window.document);
    assert.equal(info.length, 4);
    assert.equal(info[0].id, '101');
    assert.equal(info[0].courseType, 'R');
    assert.equal(info[0].isIrregular, false);
    assert.equal(info[1].id, '202');
    assert.equal(info[1].courseType, 'CMS_ON');
    assert.equal(info[1].isIrregular, true);
    assert.equal(info[2].id, '303');
    assert.equal(info[2].courseType, 'IR');
    assert.equal(info[2].isIrregular, true);
    assert.equal(info[3].id, '404');
    assert.equal(info[3].courseType, 'R');
    assert.equal(info[3].isIrregular, false);
});

test('getCourseInfoList deduplicates by id', function () {
    const localDom = new JSDOM('<!doctype html><html><body>' +
        '<div class="lists"><div class="course course-type-R" data-id="101"></div>' +
        '<div class="course course-type-R" data-id="101"></div></div>' +
    '</body></html>');
    const info = core.getCourseInfoList(localDom.window.document);
    assert.equal(info.length, 1);
});

test('getActivityIdentifier prefers stable query params', function () {
    assert.equal(
        core.getActivityIdentifier('https://learn.hoseo.ac.kr/mod/assign/view.php?id=321&rownum=1'),
        '/mod/assign/view.php?id=321'
    );
    assert.equal(
        core.getActivityIdentifier('/mod/page/view.php?cmid=45', 'https://learn.hoseo.ac.kr'),
        '/mod/page/view.php?cmid=45'
    );
});

test('normalizeComparableText removes decoration noise', function () {
    assert.equal(core.normalizeComparableText('<span>[퀴즈]</span> OT-영상!'), 'ot 영상');
});

test('findCurrentWeekIndex handles year crossing ranges', function () {
    const sortedWeeks = [0, 15, 16];
    const itemsByWeek = new Map([
        [15, [{ periodStr: '[12.20~01.03]' }]],
        [16, [{ periodStr: '[01.04~01.10]' }]]
    ]);
    const index = core.findCurrentWeekIndex(sortedWeeks, itemsByWeek, new Map(), new Map(), new Date('2026-01-02T12:00:00'));
    assert.equal(index, 1);
});

test('createCacheStore prunes expired entries without stopping early', function () {
    const storage = {
        data: {
            'lms_plus_cache:v3:u1:1': JSON.stringify({ timestamp: Date.now() - core.CACHE_TTL - 1000, data: {} }),
            'lms_plus_cache:v3:u1:2': JSON.stringify({ timestamp: Date.now(), data: { ok: true } })
        },
        get length() {
            return Object.keys(this.data).length;
        },
        key(index) {
            return Object.keys(this.data)[index] || null;
        },
        getItem(key) {
            return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null;
        },
        setItem(key, value) {
            this.data[key] = value;
        },
        removeItem(key) {
            delete this.data[key];
        }
    };

    const cacheStore = core.createCacheStore(storage);
    const activeKey = 'lms_plus_cache:v3:u1:2';
    const result = cacheStore.get(activeKey);

    assert.deepEqual(result.data, { ok: true });
    assert.equal(storage.getItem('lms_plus_cache:v3:u1:1'), null);
});

test('createAsyncCacheStore uses extension storage and prunes expired entries', async function () {
    const area = {
        items: {
            'lms_plus_cache:v3:u1:1': { timestamp: Date.now() - core.CACHE_TTL - 1, data: { stale: true } },
            'lms_plus_cache:v3:u1:2': { timestamp: Date.now(), data: { fresh: true } }
        },
        async get(key) {
            if (key === null) return { ...this.items };
            return { [key]: this.items[key] };
        },
        async set(values) {
            Object.assign(this.items, values);
        },
        async remove(keys) {
            keys.forEach((key) => {
                delete this.items[key];
            });
        }
    };

    const cacheStore = core.createAsyncCacheStore(area, null);
    const result = await cacheStore.get('lms_plus_cache:v3:u1:2');

    assert.deepEqual(result.data, { fresh: true });
    assert.equal(area.items['lms_plus_cache:v3:u1:1'], undefined);
});
