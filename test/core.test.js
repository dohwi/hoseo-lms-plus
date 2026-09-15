const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.Node = dom.window.Node;

const core = require('../lib/core.js');

function cachePayload(extra) {
    return Object.assign({ allItems: [], allAssigns: [], allActivities: [], allCourseNames: [], warnings: [], sessionExpired: false }, extra);
}

test('sanitizeHtmlToString strips unsafe attributes, protocols, and external resources', function () {
    const sanitized = core.sanitizeHtmlToString(dom.window.document, '<a href="javascript:alert(1)" onclick="alert(1)">test</a><img src="https://tracker.example/pixel.png"><script>alert(1)</script><span>ok</span>', { baseUrl: 'https://learn.hoseo.ac.kr' });
    assert.equal(sanitized.includes('javascript:'), false);
    assert.equal(sanitized.includes('onclick'), false);
    assert.equal(sanitized.includes('tracker.example'), false);
    assert.equal(sanitized.includes('<script'), false);
    assert.equal(sanitized.includes('<span>ok</span>'), true);
});

test('isSafeUrl only accepts same-origin HTTP(S) URLs', function () {
    assert.equal(core.isSafeUrl('/mod/page/view.php?id=1', 'https://learn.hoseo.ac.kr'), true);
    assert.equal(core.isSafeUrl('https://learn.hoseo.ac.kr/mod/page/view.php?id=1', 'https://learn.hoseo.ac.kr'), true);
    assert.equal(core.isSafeUrl('https://example.com/mod/page/view.php?id=1', 'https://learn.hoseo.ac.kr'), false);
    assert.equal(core.isSafeUrl('http://learn.hoseo.ac.kr/mod/page/view.php?id=1', 'https://learn.hoseo.ac.kr'), false);
    assert.equal(core.isSafeUrl('javascript:alert(1)', 'https://learn.hoseo.ac.kr'), false);
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

test('buildActivityKey uses activityKey field when present', function () {
    assert.equal(
        core.buildActivityKey({ activityKey: '/mod/assign/view.php?id=321' }),
        '/mod/assign/view.php?id=321'
    );
});

test('buildActivityKey derives key from URL fields', function () {
    assert.equal(
        core.buildActivityKey({ href: 'https://learn.hoseo.ac.kr/mod/quiz/view.php?id=55' }, 'https://learn.hoseo.ac.kr'),
        '/mod/quiz/view.php?id=55'
    );
    assert.equal(
        core.buildActivityKey({ materialHref: '/mod/page/view.php?cmid=10' }, 'https://learn.hoseo.ac.kr'),
        '/mod/page/view.php?cmid=10'
    );
    assert.equal(
        core.buildActivityKey({ viewUrl: 'https://learn.hoseo.ac.kr/mod/assign/view.php?id=99' }),
        '/mod/assign/view.php?id=99'
    );
});

test('buildActivityKey falls back to normalized name', function () {
    const key = core.buildActivityKey({ nameHtml: '<span>[퀴즈]</span> 오리엔테이션' });
    assert.equal(key, '오리엔테이션');
});

test('buildActivityKey returns null for empty input', function () {
    assert.equal(core.buildActivityKey(null), null);
    assert.equal(core.buildActivityKey({}), null);
});

test('dedupActivities filters items with null activity keys', function () {
    const items = [
        { courseId: '101', weekNum: 1, nameHtml: '' },
        { courseId: '101', weekNum: 1, nameHtml: '중복' },
        { courseId: '101', weekNum: 1, nameHtml: '중복' }
    ];
    const result = core.dedupActivities(items);
    assert.equal(result.length, 1);
    assert.equal(result[0].nameHtml, '중복');
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
    const januaryIndex = core.findCurrentWeekIndex(sortedWeeks, itemsByWeek, new Map(), new Map(), new Date('2026-01-02T12:00:00'));
    const juneIndex = core.findCurrentWeekIndex(sortedWeeks, itemsByWeek, new Map(), new Map(), new Date('2026-06-01T12:00:00'));
    const decemberIndex = core.findCurrentWeekIndex(sortedWeeks, itemsByWeek, new Map(), new Map(), new Date('2026-12-25T12:00:00'));

    assert.equal(januaryIndex, 1);
    assert.equal(juneIndex, 2);
    assert.equal(decemberIndex, 1);
});

test('createCacheStore prunes expired entries without stopping early', function () {
    const storage = {
        data: {
            'lms_plus_cache:v3:u1:1': JSON.stringify({ timestamp: Date.now() - core.CACHE_TTL - 1000, data: cachePayload() }),
            'lms_plus_cache:v3:u1:2': JSON.stringify({ timestamp: Date.now(), data: cachePayload({ ok: true }) })
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

    assert.deepEqual(result.data, cachePayload({ ok: true }));
    assert.equal(storage.getItem('lms_plus_cache:v3:u1:1'), null);
});

test('createAsyncCacheStore uses extension storage and prunes expired entries', async function () {
    const getCalls = [];
    const area = {
        items: {
            'lms_plus_cache:v3:u1:1': { timestamp: Date.now() - core.CACHE_TTL - 1, data: cachePayload({ stale: true }) },
            'lms_plus_cache:v3:u1:2': { timestamp: Date.now(), data: cachePayload({ fresh: true }) }
        },
        async get(key) {
            getCalls.push(key);
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

    assert.deepEqual(result.data, cachePayload({ fresh: true }));
    assert.equal(area.items['lms_plus_cache:v3:u1:1'], undefined);
    assert.deepEqual(getCalls, [null, 'lms_plus_cache:v3:u1:2']);
});

test('createAsyncCacheStore evicts old caches and retries after quota failure', async function () {
    let setAttempts = 0;
    const area = {
        items: {
            'lms_plus_cache:v3:u1:old': { timestamp: Date.now() - 2000, data: cachePayload({ old: true }) },
            'lms_plus_cache:v3:u1:newer': { timestamp: Date.now() - 1000, data: cachePayload({ newer: true }) }
        },
        async get() {
            return { ...this.items };
        },
        async set(values) {
            setAttempts += 1;
            if (setAttempts === 1) throw new Error('QUOTA_BYTES exceeded');
            Object.assign(this.items, values);
        },
        async remove(keys) {
            keys.forEach((key) => { delete this.items[key]; });
        }
    };

    const cacheStore = core.createAsyncCacheStore(area, null);
    await cacheStore.set('lms_plus_cache:v3:u1:current', cachePayload({ current: true }));

    assert.equal(setAttempts, 2);
    assert.deepEqual(area.items['lms_plus_cache:v3:u1:current'].data, cachePayload({ current: true }));
    assert.equal(area.items['lms_plus_cache:v3:u1:old'], undefined);
    assert.deepEqual(area.items['lms_plus_cache:v3:u1:newer'].data, cachePayload({ newer: true }));
});

test('cache stores reject invalid and oversized payloads', async function () {
    const storage = { data: {}, get length() { return 0; }, key() { return null; }, getItem(key) { return this.data[key] || null; }, setItem(key, value) { this.data[key] = value; }, removeItem(key) { delete this.data[key]; } };
    const cache = core.createCacheStore(storage);
    cache.set('lms_plus_cache:v7:u:bad', {});
    cache.set('lms_plus_cache:v7:u:large', cachePayload({ warnings: ['x'.repeat(core.CACHE_MAX_PAYLOAD_BYTES)] }));
    assert.deepEqual(storage.data, {});

    const fallback = { setItem() { throw new Error('fallback must not be used'); }, getItem() { throw new Error('fallback must not be used'); }, removeItem() {} };
    const asyncCache = core.createAsyncCacheStore({ async set() { throw new Error('storage failure'); }, async get() { throw new Error('storage failure'); }, async remove() {} }, fallback);
    await asyncCache.set('lms_plus_cache:v7:u:1', cachePayload());
});

test('request queue enforces concurrency and cancellation', async function () {
    const queue = core.createRequestQueue(1);
    let active = 0;
    let peak = 0;
    let release;
    const first = queue.enqueue(async function (signal) {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise(function (resolve, reject) {
            release = resolve;
            if (signal.aborted) reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
            else signal.addEventListener('abort', function () { reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); }, { once: true });
        });
        active -= 1;
    });
    const second = queue.enqueue(async function () {});
    const firstResult = first.then(function () { return null; }, function (error) { return error; });
    const secondResult = second.then(function () { return null; }, function (error) { return error; });
    queue.cancelAll();
    assert.equal((await firstResult).name, 'AbortError');
    assert.equal((await secondResult).name, 'AbortError');
    assert.equal(peak, 1);
    if (release) release();
});

test('getManifestVersion returns empty string when extension runtime is unavailable', function () {
    assert.equal(core.getManifestVersion(), '');
});
