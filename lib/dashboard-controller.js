(function (global, factory) {
    const exports = factory(global.HoseoLmsPlusCore, global.HoseoLmsPlusUi, global.HoseoLmsPlusDataService);
    global.HoseoLmsPlusDashboardController = exports;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = exports;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core, ui, dataService) {
    'use strict';

    const BASE_URL = core.DEFAULT_BASE_URL;

    function create(options) {
        const doc = options.document;
        const win = doc.defaultView || window;
        const runtime = options.runtime;
        let savedCourseIds = null;
        let currentMount = null;
        let currentHost = null;
        let currentCacheKey = null;
        let currentWarnings = [];
        let keyHandler = null;
        const service = dataService.create(runtime);

        function getCacheStore() {
            return core.createAsyncCacheStore(options.extensionStorage, options.storage || win.localStorage);
        }

        function getCourseContext() {
            if (!savedCourseIds) savedCourseIds = core.getCourseIds(doc);
            const userContext = core.getUserContext(doc);
            return {
                courseIds: savedCourseIds.slice(),
                userContext: userContext,
                cacheKey: core.buildCacheKey(userContext, savedCourseIds)
            };
        }

        function teardownKeyboardNavigation() {
            if (keyHandler) {
                doc.removeEventListener('keydown', keyHandler);
                keyHandler = null;
            }
        }

        function restoreHome() {
            teardownKeyboardNavigation();
            runtime.resetRequestQueue();
            ui.restoreHost(currentHost, currentMount);
            currentMount = null;
            currentHost = null;
        }

        function getRenderableActivities(data, week) {
            const activitiesByWeek = core.groupByWeek(data.allActivities);
            return core.dedupActivities((activitiesByWeek.get(week) || []).slice());
        }

        function bindKeyboardNavigation(renderState) {
            teardownKeyboardNavigation();
            keyHandler = function (event) {
                const target = event.target;
                if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
                if (!doc.getElementById(core.SELECTORS.dashboardMountId)) {
                    teardownKeyboardNavigation();
                    return;
                }
                if (event.key === 'ArrowLeft' && renderState.weekIdx > 0) {
                    renderState.weekIdx -= 1;
                    renderState.render();
                } else if (event.key === 'ArrowRight' && renderState.weekIdx < renderState.sortedWeeks.length - 1) {
                    renderState.weekIdx += 1;
                    renderState.render();
                }
            };
            doc.addEventListener('keydown', keyHandler);
        }

        function renderDashboardData(data) {
            const itemsByWeek = core.groupByWeek(data.allItems);
            const assignsByWeek = core.groupByWeek(data.allAssigns);
            const activitiesByWeek = core.groupByWeek(data.allActivities);
            const weekSet = new Set([].concat(Array.from(itemsByWeek.keys()), Array.from(assignsByWeek.keys()), Array.from(activitiesByWeek.keys())));
            const sortedWeeks = Array.from(weekSet).sort((left, right) => left - right);

            if (!sortedWeeks.length) {
                ui.renderMessage(doc, currentMount, '표시할 주차가 없습니다.', '', [{ id: 'lms-home-btn', text: 'LMS 홈으로 복귀', onClick: restoreHome }]);
                return;
            }

            const incActivities = core.dedupActivities(
                data.allActivities.filter((item) => !item.isCompleted && !item.isNeutral)
            ).sort((left, right) => left.courseName.localeCompare(right.courseName) || left.weekNum - right.weekNum);

            const renderState = {
                sortedWeeks: sortedWeeks,
                weekIdx: core.findCurrentWeekIndex(sortedWeeks, itemsByWeek, assignsByWeek, activitiesByWeek)
            };

            renderState.render = function () {
                const week = renderState.sortedWeeks[renderState.weekIdx];
                const activities = getRenderableActivities(data, week);
                const periodStr = (itemsByWeek.get(week) && itemsByWeek.get(week)[0] ||
                    assignsByWeek.get(week) && assignsByWeek.get(week)[0] ||
                    activities[0] || {}).periodStr || '';

                ui.renderDashboard(doc, currentMount, {
                    week: week,
                    periodStr: periodStr,
                    activities: activities,
                    incActivities: incActivities,
                    courseNames: data.allCourseNames,
                    warnings: currentWarnings,
                    canPrev: renderState.weekIdx > 0,
                    canNext: renderState.weekIdx < renderState.sortedWeeks.length - 1,
                    baseUrl: BASE_URL,
                    handlers: {
                        onHome: restoreHome,
                        onRefresh: async function () {
                            await getCacheStore().remove(currentCacheKey);
                            replacePageContent(true);
                        },
                        onPrev: function () {
                            if (renderState.weekIdx > 0) {
                                renderState.weekIdx -= 1;
                                renderState.render();
                            }
                        },
                        onNext: function () {
                            if (renderState.weekIdx < renderState.sortedWeeks.length - 1) {
                                renderState.weekIdx += 1;
                                renderState.render();
                            }
                        }
                    }
                });
            };

            bindKeyboardNavigation(renderState);
            renderState.render();
        }

        async function fetchAndRender(courseIds, forceRefresh) {
            const cacheStore = getCacheStore();
            const context = getCourseContext();
            currentCacheKey = context.cacheKey;
            currentWarnings = [];

            if (!courseIds.length) {
                ui.renderMessage(doc, currentMount, '강좌를 찾을 수 없습니다.', '', [{ id: 'lms-home-btn', text: 'LMS 홈으로 복귀', onClick: restoreHome }]);
                return;
            }

            const cached = !forceRefresh ? await cacheStore.get(context.cacheKey) : null;
            let data = cached ? cached.data : null;

            if (!data) {
                try {
                    data = await service.fetchAllCourseData(courseIds, function (loaded, total) {
                        ui.updateProgress(doc, loaded, total);
                    });
                    if (!data.sessionExpired) await cacheStore.set(context.cacheKey, data);
                } catch (error) {
                    if (error && error.name === 'AbortError') return;
                    console.warn('[호서 LMS+] 데이터 로딩 실패:', error);
                }
            }

            if (data && data.sessionExpired) {
                ui.renderMessage(doc, currentMount, '로그인 세션이 만료되었습니다.', '페이지를 새로고침하고 다시 로그인해주세요.', [{ id: 'lms-reload-btn', text: '새로고침', onClick: () => { win.location.reload(); } }], 'lms-message-danger');
                return;
            }

            if (!data || (!data.allItems.length && !data.allAssigns.length && !data.allActivities.length)) {
                ui.renderMessage(doc, currentMount, '출석 및 과제 정보를 불러올 수 없거나 항목이 없습니다.', '', [{ id: 'lms-home-btn', text: 'LMS 홈으로 복귀', onClick: restoreHome }], 'lms-message-danger');
                return;
            }

            currentWarnings = currentWarnings.concat(data.warnings || []);
            renderDashboardData(data);
        }

        function replacePageContent(forceRefresh) {
            runtime.resetRequestQueue();
            const latestCourseIds = core.getCourseIds(doc);
            if (latestCourseIds.length) savedCourseIds = latestCourseIds;
            const hostParts = ui.buildHostMount(doc);
            currentMount = hostParts.mount;
            currentHost = hostParts.host;
            doc.title = '호서 LMS+ 대시보드';
            ui.renderLoading(doc, currentMount);
            fetchAndRender(getCourseContext().courseIds, forceRefresh);
        }

        function cleanup() {
            teardownKeyboardNavigation();
            runtime.resetRequestQueue();
        }

        return {
            cleanup: cleanup,
            replacePageContent: replacePageContent,
            restoreHome: restoreHome
        };
    }

    return {
        create: create
    };
});
