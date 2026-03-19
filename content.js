// ===== 호서 LMS+ 대시보드 ======
// 메인 페이지(/ 또는 /index.php)에서만 동작

(function () {
    'use strict';

    const core = window.HoseoLmsPlusCore;
    const dashboardController = window.HoseoLmsPlusDashboardController;
    const sidebar = window.HoseoLmsPlusSidebar;

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
        extensionStorage: typeof chrome !== 'undefined' && chrome.storage ? chrome.storage.local : null,
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
