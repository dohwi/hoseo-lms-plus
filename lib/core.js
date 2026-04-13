(function (global, factory) {
    const exports = factory();
    global.HoseoLmsPlusCore = exports;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = exports;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const CACHE_VERSION = 'v3';
    const CACHE_TTL = 6 * 60 * 60 * 1000;
    const OTHER_WEEK_NUM = 0;
    const LOGIN_PATTERN = '/login/';
    const DEFAULT_BASE_URL = 'https://learn.hoseo.ac.kr';
    const CACHE_PREFIX = 'lms_plus_cache:';
    const SAFE_PROTOCOLS = new Set(['http:', 'https:']);
    const INLINE_TAGS = new Set(['A', 'B', 'BR', 'EM', 'I', 'IMG', 'SMALL', 'SPAN', 'STRONG']);
    const INLINE_ATTRS = {
        A: new Set(['href', 'target', 'rel', 'title', 'aria-label']),
        IMG: new Set(['src', 'alt', 'width', 'height'])
    };
    const TEXT_ONLY_TAGS = new Set(['DIV', 'P']);
    const SELECTORS = {
        courseItems: '.lists .course, .course-card[data-id], [data-course-id], .block_myoverview [data-course-id]',
        dashboardMountId: 'lms-custom-dashboard',
        mainHosts: ['#region-main', '#page-content', 'main'],
        sidebarContainer: '#mCSB_1_container, #nav-drawer, .drawer-left, aside[role="navigation"]',
        sidebarMenu: '#mCSB_1_container > ul, #nav-drawer ul, .drawer-left ul, aside[role="navigation"] ul',
        userContext: '[data-userid], [id*="user-menu-toggle"], .usermenu [data-userid]',
        userName: '.usertext, .userbutton .usertext, .usermenu .usertext'
    };

    function normalizeText(value) {
        return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function stripHtml(value) {
        return normalizeText(String(value || '').replace(/<[^>]*>?/g, ' '));
    }

    function stripBr(value) {
        return normalizeText(String(value || '').replace(/<br\s*\/?>/gi, ' '));
    }

    function normalizeComparableText(value) {
        return stripHtml(value).toLowerCase().replace(/\[[^\]]+\]/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
    }

    function getWeekLabel(weekNum) {
        return weekNum === OTHER_WEEK_NUM ? '기타' : weekNum + '주차';
    }

    function isSafeUrl(url, baseUrl) {
        if (!url) return false;
        try {
            const parsed = new URL(url, baseUrl || DEFAULT_BASE_URL);
            return SAFE_PROTOCOLS.has(parsed.protocol);
        } catch {
            return false;
        }
    }

    function getActivityIdentifier(url, baseUrl) {
        if (!url) return '';
        try {
            const parsed = new URL(url, baseUrl || DEFAULT_BASE_URL);
            const keys = ['cmid', 'coursemodule', 'activity', 'id'];
            for (const key of keys) {
                const value = parsed.searchParams.get(key);
                if (value) return parsed.pathname + '?' + key + '=' + value;
            }
            return parsed.pathname;
        } catch {
            return '';
        }
    }

    function extractFirstSafeHref(doc, html, baseUrl) {
        const safeDoc = doc || document;
        const Parser = safeDoc.defaultView && safeDoc.defaultView.DOMParser ? safeDoc.defaultView.DOMParser : DOMParser;
        const parsedDoc = new Parser().parseFromString(String(html || ''), 'text/html');
        const anchor = parsedDoc.querySelector('a[href], img[src]');
        if (!anchor) return null;
        const attrName = anchor.tagName.toUpperCase() === 'IMG' ? 'src' : 'href';
        const value = anchor.getAttribute(attrName);
        return isSafeUrl(value, baseUrl) ? new URL(value, baseUrl || DEFAULT_BASE_URL).toString() : null;
    }

    function sanitizeHtmlFragment(doc, html, options) {
        const safeDoc = doc || document;
        const Parser = safeDoc.defaultView && safeDoc.defaultView.DOMParser ? safeDoc.defaultView.DOMParser : DOMParser;
        const parsedDoc = new Parser().parseFromString(String(html || ''), 'text/html');
        const fragment = safeDoc.createDocumentFragment();
        const baseUrl = (options && options.baseUrl) || DEFAULT_BASE_URL;

        function appendChildren(source, target) {
            Array.from(source.childNodes).forEach((child) => {
                appendNode(child, target);
            });
        }

        function appendNode(node, target) {
            if (node.nodeType === Node.TEXT_NODE) {
                target.appendChild(safeDoc.createTextNode(node.textContent || ''));
                return;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return;

            const tagName = node.tagName.toUpperCase();
            if (tagName === 'SCRIPT' || tagName === 'STYLE' || tagName === 'IFRAME') return;
            if (TEXT_ONLY_TAGS.has(tagName)) {
                appendChildren(node, target);
                if (tagName === 'P') target.appendChild(safeDoc.createElement('br'));
                return;
            }
            if (!INLINE_TAGS.has(tagName)) {
                appendChildren(node, target);
                return;
            }

            const nextEl = safeDoc.createElement(tagName.toLowerCase());
            const allowedAttrs = INLINE_ATTRS[tagName] || new Set();
            Array.from(node.attributes).forEach((attr) => {
                const name = attr.name.toLowerCase();
                if (name.startsWith('on')) return;
                if (!allowedAttrs.has(attr.name)) return;
                if ((name === 'href' || name === 'src') && !isSafeUrl(attr.value, baseUrl)) return;
                nextEl.setAttribute(name, attr.value);
            });

            if (tagName === 'A') {
                nextEl.setAttribute('target', '_blank');
                nextEl.setAttribute('rel', 'noopener noreferrer');
            }

            appendChildren(node, nextEl);
            target.appendChild(nextEl);
        }

        appendChildren(parsedDoc.body, fragment);
        return fragment;
    }

    function fragmentToHtml(doc, fragment) {
        const container = (doc || document).createElement('div');
        container.appendChild(fragment.cloneNode(true));
        return container.innerHTML;
    }

    function sanitizeHtmlToString(doc, html, options) {
        return fragmentToHtml(doc, sanitizeHtmlFragment(doc, html, options));
    }

    function groupByWeek(arr) {
        const map = new Map();
        arr.forEach((item) => {
            if (!map.has(item.weekNum)) map.set(item.weekNum, []);
            map.get(item.weekNum).push(item);
        });
        return map;
    }

    function dedupActivities(arr) {
        const seen = new Set();
        return arr.filter((item) => {
            const key = [item.courseId, item.weekNum, stripHtml(item.nameHtml || item.nameText)].join('|');
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function parsePeriodRange(periodStr, now) {
        const normalized = String(periodStr || '');
        const match = normalized.match(/\[?\s*(\d+)[^\d]+(\d+)[^\d]+(\d+)[^\d]+(\d+)/);
        if (!match) return null;

        const current = now instanceof Date ? now : new Date();
        const year = current.getFullYear();
        const startMonth = Number(match[1]) - 1;
        const startDay = Number(match[2]);
        const endMonth = Number(match[3]) - 1;
        const endDay = Number(match[4]);
        const start = new Date(year, startMonth, startDay, 0, 0, 0, 0);
        const end = new Date(year, endMonth, endDay, 23, 59, 59, 999);

        if (endMonth < startMonth) {
            end.setFullYear(year + 1);
            if (current.getMonth() < startMonth) start.setFullYear(year - 1);
        }

        return { start: start, end: end };
    }

    function findCurrentWeekIndex(sortedWeeks, itemsByWeek, assignsByWeek, activitiesByWeek, now) {
        const current = now instanceof Date ? now : new Date();
        let bestPast = -1;
        let bestPastDiff = Infinity;
        for (let index = 0; index < sortedWeeks.length; index += 1) {
            const week = sortedWeeks[index];
            const periodStr = (itemsByWeek.get(week) && itemsByWeek.get(week)[0] ||
                assignsByWeek.get(week) && assignsByWeek.get(week)[0] ||
                activitiesByWeek.get(week) && activitiesByWeek.get(week)[0] || {}).periodStr;
            const range = parsePeriodRange(periodStr, current);
            if (!range) continue;
            if (current >= range.start && current <= range.end) return index;
            const diff = current.getTime() - range.end.getTime();
            if (diff > 0 && diff < bestPastDiff) {
                bestPastDiff = diff;
                bestPast = index;
            }
        }
        if (bestPast >= 0) return bestPast;
        const firstRegularWeek = sortedWeeks.findIndex((week) => week !== OTHER_WEEK_NUM);
        return firstRegularWeek >= 0 ? firstRegularWeek : 0;
    }

    const IRREGULAR_COURSE_TYPES = new Set(['CMS_ON', 'IR', 'CMS_E', 'CMS_O', 'CMS_M']);

    function getCourseIds(doc) {
        return Array.from((doc || document).querySelectorAll(SELECTORS.courseItems))
            .map((element) => element.getAttribute('data-id') || element.getAttribute('data-course-id'))
            .filter((id, index, all) => id && all.indexOf(id) === index);
    }

    function getCourseInfoList(doc) {
        const seen = new Set();
        return Array.from((doc || document).querySelectorAll(SELECTORS.courseItems))
            .map((element) => {
                const id = element.getAttribute('data-id') || element.getAttribute('data-course-id');
                const typeMatch = (element.className || '').match(/course-type-(\S+)/);
                const courseType = typeMatch ? typeMatch[1] : '';
                return { id: id, courseType: courseType, isIrregular: IRREGULAR_COURSE_TYPES.has(courseType) };
            })
            .filter((item) => {
                if (!item.id || seen.has(item.id)) return false;
                seen.add(item.id);
                return true;
            });
    }

    function getUserContext(doc) {
        const root = doc || document;
        const userMenu = root.querySelector(SELECTORS.userContext);
        const userId = userMenu ? userMenu.getAttribute('data-userid') : '';
        const bodyUser = root.body ? root.body.getAttribute('data-userid') : '';
        const userName = normalizeText((root.querySelector(SELECTORS.userName) || {}).textContent || '');
        return { userId: userId || bodyUser || userName || 'anonymous' };
    }

    function buildCacheKey(userContext, courseIds) {
        const ids = (courseIds || []).slice().sort().join(',');
        return ['lms_plus_cache', CACHE_VERSION, (userContext && userContext.userId) || 'anonymous', ids].join(':');
    }

    function createCacheStore(storage) {
        const target = storage || (typeof localStorage !== 'undefined' ? localStorage : null);

        function pruneExpiredEntries() {
            if (!target || typeof target.length !== 'number' || typeof target.key !== 'function') return;
            try {
                const keys = [];
                for (let index = 0; index < target.length; index += 1) {
                    const key = target.key(index);
                    if (key && key.startsWith(CACHE_PREFIX)) keys.push(key);
                }
                for (const key of keys) {
                    try {
                        const raw = target.getItem(key);
                        if (!raw) continue;
                        const parsed = JSON.parse(raw);
                        if (!parsed || typeof parsed.timestamp !== 'number' || Date.now() - parsed.timestamp > CACHE_TTL) {
                            target.removeItem(key);
                        }
                    } catch {
                        target.removeItem(key);
                    }
                }
            } catch {
                return;
            }
        }

        function get(cacheKey) {
            if (!target) return null;
            try {
                pruneExpiredEntries();
                const raw = target.getItem(cacheKey);
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                if (Date.now() - parsed.timestamp > CACHE_TTL) {
                    target.removeItem(cacheKey);
                    return null;
                }
                return parsed;
            } catch {
                return null;
            }
        }

        function set(cacheKey, payload) {
            if (!target) return;
            try {
                pruneExpiredEntries();
                target.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: payload }));
            } catch {
                return;
            }
        }

        function remove(cacheKey) {
            if (!target) return;
            try {
                target.removeItem(cacheKey);
            } catch {
                return;
            }
        }

        return { get: get, set: set, remove: remove };
    }

    function createAsyncCacheStore(extensionStorage, fallbackStorage) {
        const syncStore = createCacheStore(fallbackStorage);
        const area = extensionStorage || null;

        function asPromise(callbackBased) {
            return new Promise((resolve, reject) => {
                try {
                    callbackBased(resolve, reject);
                } catch (error) {
                    reject(error);
                }
            });
        }

        function readLastError() {
            if (typeof globalThis !== 'undefined') {
                if (globalThis.chrome && globalThis.chrome.runtime) return globalThis.chrome.runtime.lastError || null;
                if (globalThis.browser && globalThis.browser.runtime) return globalThis.browser.runtime.lastError || null;
            }
            return null;
        }

        function getAll(areaRef) {
            if (!areaRef || typeof areaRef.get !== 'function') return Promise.resolve(null);
            try {
                const result = areaRef.get(null);
                if (result && typeof result.then === 'function') return result;
            } catch {
                return asPromise(function (resolve, reject) {
                    areaRef.get(null, function (items) {
                        const runtimeError = readLastError();
                        if (runtimeError) reject(runtimeError);
                        else resolve(items);
                    });
                });
            }
            return asPromise(function (resolve, reject) {
                areaRef.get(null, function (items) {
                    const runtimeError = readLastError();
                    if (runtimeError) reject(runtimeError);
                    else resolve(items);
                });
            });
        }

        function setItems(areaRef, values) {
            if (!areaRef || typeof areaRef.set !== 'function') return Promise.resolve();
            try {
                const result = areaRef.set(values);
                if (result && typeof result.then === 'function') return result;
            } catch {
                return asPromise(function (resolve, reject) {
                    areaRef.set(values, function () {
                        const runtimeError = readLastError();
                        if (runtimeError) reject(runtimeError);
                        else resolve();
                    });
                });
            }
            return asPromise(function (resolve, reject) {
                areaRef.set(values, function () {
                    const runtimeError = readLastError();
                    if (runtimeError) reject(runtimeError);
                    else resolve();
                });
            });
        }

        function removeItems(areaRef, keys) {
            if (!areaRef || typeof areaRef.remove !== 'function') return Promise.resolve();
            try {
                const result = areaRef.remove(keys);
                if (result && typeof result.then === 'function') return result;
            } catch {
                return asPromise(function (resolve, reject) {
                    areaRef.remove(keys, function () {
                        const runtimeError = readLastError();
                        if (runtimeError) reject(runtimeError);
                        else resolve();
                    });
                });
            }
            return asPromise(function (resolve, reject) {
                areaRef.remove(keys, function () {
                    const runtimeError = readLastError();
                    if (runtimeError) reject(runtimeError);
                    else resolve();
                });
            });
        }

        async function pruneExpiredEntries() {
            if (!area) return;
            try {
                const items = await getAll(area);
                if (!items) return;
                const expiredKeys = Object.keys(items).filter(function (key) {
                    if (!key.startsWith(CACHE_PREFIX)) return false;
                    const entry = items[key];
                    return !entry || typeof entry.timestamp !== 'number' || Date.now() - entry.timestamp > CACHE_TTL;
                });
                if (expiredKeys.length) await removeItems(area, expiredKeys);
            } catch {
                return;
            }
        }

        async function get(cacheKey) {
            if (!area) return syncStore.get(cacheKey);
            try {
                await pruneExpiredEntries();
                const items = await getAll(area);
                const entry = items ? items[cacheKey] : null;
                if (!entry) return null;
                if (Date.now() - entry.timestamp > CACHE_TTL) {
                    await removeItems(area, [cacheKey]);
                    return null;
                }
                return entry;
            } catch {
                return syncStore.get(cacheKey);
            }
        }

        async function set(cacheKey, payload) {
            if (!area) {
                syncStore.set(cacheKey, payload);
                return;
            }
            try {
                await pruneExpiredEntries();
                await setItems(area, { [cacheKey]: { timestamp: Date.now(), data: payload } });
            } catch {
                syncStore.set(cacheKey, payload);
            }
        }

        async function remove(cacheKey) {
            if (!area) {
                syncStore.remove(cacheKey);
                return;
            }
            try {
                await removeItems(area, [cacheKey]);
            } catch {
                syncStore.remove(cacheKey);
            }
        }

        return { get: get, set: set, remove: remove };
    }

    function createRequestQueue(limit) {
        const concurrency = Math.max(1, limit || 6);
        const pending = [];
        const controllers = new Set();
        let activeCount = 0;
        let closed = false;

        function rejectAbort(item) {
            const error = new Error('Request queue aborted');
            error.name = 'AbortError';
            item.reject(error);
        }

        function pump() {
            if (closed) {
                while (pending.length) rejectAbort(pending.shift());
                return;
            }

            while (activeCount < concurrency && pending.length) {
                const item = pending.shift();
                const controller = new AbortController();
                controllers.add(controller);
                activeCount += 1;

                Promise.resolve()
                    .then(() => item.task(controller.signal))
                    .then(item.resolve, item.reject)
                    .finally(() => {
                        activeCount -= 1;
                        controllers.delete(controller);
                        pump();
                    });
            }
        }

        function enqueue(task) {
            return new Promise((resolve, reject) => {
                pending.push({ task: task, resolve: resolve, reject: reject });
                pump();
            });
        }

        function cancelAll() {
            closed = true;
            controllers.forEach((controller) => controller.abort());
            while (pending.length) rejectAbort(pending.shift());
        }

        return { enqueue: enqueue, cancelAll: cancelAll };
    }

    return {
        CACHE_TTL: CACHE_TTL,
        DEFAULT_BASE_URL: DEFAULT_BASE_URL,
        LOGIN_PATTERN: LOGIN_PATTERN,
        OTHER_WEEK_NUM: OTHER_WEEK_NUM,
        SELECTORS: SELECTORS,
        buildCacheKey: buildCacheKey,
        createAsyncCacheStore: createAsyncCacheStore,
        createCacheStore: createCacheStore,
        createRequestQueue: createRequestQueue,
        dedupActivities: dedupActivities,
        extractFirstSafeHref: extractFirstSafeHref,
        findCurrentWeekIndex: findCurrentWeekIndex,
        getActivityIdentifier: getActivityIdentifier,
        getCourseIds: getCourseIds,
        getCourseInfoList: getCourseInfoList,
        getUserContext: getUserContext,
        getWeekLabel: getWeekLabel,
        groupByWeek: groupByWeek,
        normalizeComparableText: normalizeComparableText,
        normalizeText: normalizeText,
        sanitizeHtmlFragment: sanitizeHtmlFragment,
        sanitizeHtmlToString: sanitizeHtmlToString,
        stripBr: stripBr,
        stripHtml: stripHtml
    };
});
