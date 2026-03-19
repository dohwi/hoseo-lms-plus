(function (global, factory) {
    const exports = factory(global.HoseoLmsPlusCore);
    global.HoseoLmsPlusSidebar = exports;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = exports;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core) {
    'use strict';

    const MAX_TAB_RETRIES = 10;

    function create(options) {
        const doc = options.document;
        const win = doc.defaultView || window;
        let observer = null;
        let retryTimerId = null;
        let tabRetries = 0;

        function clearRetryTimer() {
            if (retryTimerId) {
                win.clearTimeout(retryTimerId);
                retryTimerId = null;
            }
        }

        function addCalendarTab() {
            const menu = doc.querySelector(core.SELECTORS.sidebarMenu);
            if (menu && !doc.getElementById('lms-calendar-tab')) {
                const listItem = doc.createElement('li');
                listItem.id = 'lms-calendar-tab';
                listItem.className = 'menu-item';
                const anchor = doc.createElement('a');
                anchor.href = '#';
                anchor.className = 'site-menu-link nosubmenu';
                anchor.title = '호서 LMS+ 대시보드';
                anchor.style.cursor = 'pointer';
                anchor.setAttribute('role', 'button');

                const icon = doc.createElement('i');
                icon.className = 'fa site-menu-icon fa-th-list';
                icon.setAttribute('aria-hidden', 'true');
                const label = doc.createElement('div');
                label.className = 'text-truncate';
                label.textContent = '호서 LMS+';

                anchor.appendChild(icon);
                anchor.appendChild(label);
                anchor.addEventListener('click', (event) => {
                    event.preventDefault();
                    options.onOpenDashboard();
                });
                listItem.appendChild(anchor);
                menu.appendChild(listItem);
                return true;
            }
            return false;
        }

        function ensureCalendarTab() {
            clearRetryTimer();
            if (addCalendarTab()) return;
            if (!doc.getElementById('lms-calendar-tab') && tabRetries < MAX_TAB_RETRIES) {
                tabRetries += 1;
                retryTimerId = win.setTimeout(ensureCalendarTab, 1000);
            }
        }

        function start() {
            ensureCalendarTab();
            if (observer) observer.disconnect();
            observer = new MutationObserver(() => {
                if (!doc.getElementById('lms-calendar-tab') && doc.querySelector(core.SELECTORS.sidebarMenu)) {
                    tabRetries = 0;
                    ensureCalendarTab();
                }
            });

            const sidebar = doc.querySelector(core.SELECTORS.sidebarContainer) || doc.body;
            observer.observe(sidebar, { childList: true, subtree: true });
        }

        function cleanup() {
            clearRetryTimer();
            if (observer) observer.disconnect();
            observer = null;
        }

        return {
            cleanup: cleanup,
            start: start
        };
    }

    return {
        create: create
    };
});
