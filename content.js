// ===== 호서 LMS+ 대시보드 ======
// 메인 페이지(/ 또는 /index.php)에서만 동작

(function () {
    'use strict';

    const _g = typeof globalThis !== 'undefined' ? globalThis : window;
    const core = _g.HoseoLmsPlusCore;
    const dashboardController = _g.HoseoLmsPlusDashboardController;
    const sidebar = _g.HoseoLmsPlusSidebar;
    const extensionApi = typeof _g.browser !== 'undefined' && _g.browser
        ? _g.browser
        : (typeof _g.chrome !== 'undefined' ? _g.chrome : null);

    if (window.location.pathname !== '/' && window.location.pathname !== '/index.php') return;

    let requestQueue = null;
    const REQUEST_CONCURRENCY = 6;

    function resetRequestQueue() {
        if (requestQueue) requestQueue.cancelAll();
        requestQueue = core.createRequestQueue(REQUEST_CONCURRENCY);
    }

    resetRequestQueue();

    const runtime = {
        getRequestQueue: function () {
            return requestQueue;
        },
        resetRequestQueue: resetRequestQueue
    };

    const dashboard = dashboardController.create({
        document: document,
        extensionStorage: extensionApi && extensionApi.storage ? extensionApi.storage.local : null,
        runtime: runtime,
        storage: window.localStorage
    });

    const sidebarApp = sidebar.create({
        document: document,
        onOpenDashboard: function () {
            dashboard.replacePageContent(false);
        }
    });

    sidebarApp.start();

    window.addEventListener('beforeunload', function () {
        sidebarApp.cleanup();
        dashboard.cleanup();
    }, { once: true });
})();
