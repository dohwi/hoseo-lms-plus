(function (global, factory) {
    const exports = factory(global.HoseoLmsPlusCore);
    global.HoseoLmsPlusUi = exports;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = exports;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core) {
    'use strict';

    function createElement(doc, tagName, options) {
        const element = doc.createElement(tagName);
        const config = options || {};
        if (config.className) element.className = config.className;
        if (config.text !== null && config.text !== undefined) element.textContent = config.text;
        if (config.attrs) {
            Object.keys(config.attrs).forEach((name) => {
                if (config.attrs[name] !== null && config.attrs[name] !== undefined) element.setAttribute(name, config.attrs[name]);
            });
        }
        return element;
    }

    function appendSanitizedHtml(target, html, baseUrl) {
        const fragment = core.sanitizeHtmlFragment(target.ownerDocument, html, { baseUrl: baseUrl || core.DEFAULT_BASE_URL });
        target.appendChild(fragment);
    }

    function clearChildren(target) {
        while (target.firstChild) target.removeChild(target.firstChild);
    }

    function createButton(doc, id, text, className, onClick, disabled, ariaLabel) {
        const button = createElement(doc, 'button', {
            className: className,
            text: text,
            attrs: { type: 'button', id: id, 'aria-label': ariaLabel || text }
        });
        button.disabled = Boolean(disabled);
        if (onClick) button.addEventListener('click', onClick);
        return button;
    }

    function buildHostMount(doc) {
        const host = core.SELECTORS.mainHosts.map((selector) => doc.querySelector(selector)).find(Boolean) || doc.body;
        let mount = doc.getElementById(core.SELECTORS.dashboardMountId);
        if (mount) return { mount: mount, host: host };

        mount = createElement(doc, 'section', {
            className: 'lms-dashboard',
            attrs: { id: core.SELECTORS.dashboardMountId, role: 'region', 'aria-label': '호서 LMS 플러스 대시보드' }
        });
        mount.tabIndex = -1;
        if (host === doc.body) {
            host.appendChild(mount);
        } else {
            const originalContent = doc.createDocumentFragment();
            while (host.firstChild) {
                originalContent.appendChild(host.firstChild);
            }
            host.__lmsOriginalContent = originalContent;
            host.appendChild(mount);
        }
        return { mount: mount, host: host };
    }

    function restoreHost(host, mount) {
        if (mount && mount.parentNode) mount.parentNode.removeChild(mount);
        if (host && host !== host.ownerDocument.body && host.__lmsOriginalContent) {
            host.appendChild(host.__lmsOriginalContent);
            delete host.__lmsOriginalContent;
        }
    }

    function renderLoading(doc, mount) {
        clearChildren(mount);
        const card = createElement(doc, 'div', { className: 'lms-card lms-loading' });
        card.appendChild(createElement(doc, 'h3', { className: 'lms-loading-title', text: '출석 정보를 불러오고 있습니다...' }));
        const progressContainer = createElement(doc, 'div', { className: 'lms-progress-container' });
        progressContainer.appendChild(createElement(doc, 'div', { className: 'lms-progress-bar', attrs: { id: 'lms-progress-bar' } }));
        card.appendChild(progressContainer);
        card.appendChild(createElement(doc, 'p', { className: 'lms-loading-sub', text: '잠시만 기다려주세요.', attrs: { id: 'lms-loading-text', 'aria-live': 'polite' } }));
        mount.appendChild(card);
    }

    function renderMessage(doc, mount, title, body, actions, tone) {
        clearChildren(mount);
        const card = createElement(doc, 'div', { className: 'lms-card lms-message-card' + (tone ? ' ' + tone : '') });
        card.appendChild(createElement(doc, 'h3', { className: 'lms-message-title', text: title }));
        if (body) card.appendChild(createElement(doc, 'p', { className: 'lms-message-body', text: body }));
        const row = createElement(doc, 'div', { className: 'lms-message-actions' });
        (actions || []).forEach((action) => {
            row.appendChild(createButton(doc, action.id, action.text, action.className || 'btn btn-primary lms-btn', action.onClick));
        });
        if (row.childNodes.length) card.appendChild(row);
        mount.appendChild(card);
    }

    function updateProgress(doc, loaded, total) {
        const bar = doc.getElementById('lms-progress-bar');
        const text = doc.getElementById('lms-loading-text');
        if (bar) bar.style.width = ((loaded / total) * 100) + '%';
        if (text) text.textContent = loaded + '/' + total + ' 강좌 로딩 중...';
    }

    function createWarningList(doc, warnings) {
        if (!warnings || !warnings.length) return null;
        const card = createElement(doc, 'div', { className: 'lms-card lms-warning-card' });
        card.appendChild(createElement(doc, 'h4', { className: 'lms-warning-title', text: '일부 강좌 정보를 완전히 불러오지 못했습니다.' }));
        const list = createElement(doc, 'ul', { className: 'lms-warning-list' });
        warnings.forEach((warning) => {
            list.appendChild(createElement(doc, 'li', { text: warning }));
        });
        card.appendChild(list);
        return card;
    }

    function createHtmlCell(doc, className, html, baseUrl) {
        const cell = createElement(doc, 'td', { className: className });
        if (!html || html === '-') {
            cell.textContent = '-';
        } else {
            appendSanitizedHtml(cell, html, baseUrl);
        }
        return cell;
    }

    function createCourseCell(doc, activity, rowspan, isFirst) {
        if (!isFirst) return null;
        const cell = createElement(doc, 'td', { className: 'lms-td-course' });
        cell.rowSpan = rowspan;
        const link = createElement(doc, 'a', {
            text: activity.courseName,
            attrs: { href: '/course/view.php?id=' + activity.courseId, target: '_blank', rel: 'noopener noreferrer' }
        });
        cell.appendChild(link);
        return cell;
    }

    function createActivityRows(doc, activities, baseUrl, includeWeek) {
        const sorted = activities.slice().sort((left, right) => left.courseName.localeCompare(right.courseName) || left.weekNum - right.weekNum);
        const groupSizes = new Map();
        sorted.forEach((activity) => {
            groupSizes.set(activity.courseId, (groupSizes.get(activity.courseId) || 0) + 1);
        });
        let previousCourseId = null;

        return sorted.map((activity) => {
            const row = createElement(doc, 'tr', { className: activity.isNeutral ? 'lms-row-neutral' : (activity.isCompleted ? 'lms-row-success' : 'lms-row-danger') });
            const isFirst = activity.courseId !== previousCourseId;
            previousCourseId = activity.courseId;

            const courseCell = createCourseCell(doc, activity, groupSizes.get(activity.courseId), isFirst);
            if (courseCell) row.appendChild(courseCell);
            if (includeWeek) row.appendChild(createElement(doc, 'td', { className: 'lms-td-week', text: core.getWeekLabel(activity.weekNum) }));
            row.appendChild(createElement(doc, 'td', { text: activity.type || '-' }));

            const nameCell = createElement(doc, 'td', { className: 'lms-td-left' });
            if (activity.href && activity.nameHtml && activity.nameHtml !== '-') {
                const anchor = createElement(doc, 'a', { attrs: { href: activity.href, target: '_blank', rel: 'noopener noreferrer' } });
                appendSanitizedHtml(anchor, activity.nameHtml, baseUrl);
                nameCell.appendChild(anchor);
            } else {
                appendSanitizedHtml(nameCell, activity.nameHtml || '-', baseUrl);
            }
            row.appendChild(nameCell);

            row.appendChild(createHtmlCell(doc, 'lms-td-options', activity.optionsHtml || '-', baseUrl));
            const statusCell = createElement(doc, 'td');
            if (activity.isNeutral) {
                statusCell.textContent = '-';
            } else {
                statusCell.appendChild(createElement(doc, 'span', {
                    className: activity.isCompleted ? 'lms-status-ok' : 'lms-status-fail',
                    text: activity.statusText || (activity.isCompleted ? '완료' : '미완료')
                }));
            }
            row.appendChild(statusCell);
            return row;
        });
    }

    function buildTable(doc, title, icon, headers, rows, dangerHead) {
        const wrapper = createElement(doc, 'div', { className: 'lms-table-wrap' });
        if (title) wrapper.appendChild(createElement(doc, 'h4', { className: 'lms-section-title', text: icon + ' ' + title }));
        const table = createElement(doc, 'table', { className: 'table table-bordered table-hover lms-table' });
        const thead = createElement(doc, 'thead');
        const headerRow = createElement(doc, 'tr', { className: dangerHead ? 'lms-thead-danger' : 'lms-thead-row' });
        headers.forEach((header) => {
            headerRow.appendChild(createElement(doc, 'th', { text: header.text, className: header.className, attrs: header.attrs }));
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);
        const tbody = createElement(doc, 'tbody');
        rows.forEach((row) => { tbody.appendChild(row); });
        table.appendChild(tbody);
        wrapper.appendChild(table);
        return wrapper;
    }

    function renderDashboard(doc, mount, state) {
        clearChildren(mount);

        const header = createElement(doc, 'div', { className: 'lms-card lms-header' });
        header.appendChild(createElement(doc, 'h3', { className: 'lms-title', text: '호서 LMS+ 대시보드' }));
        const actions = createElement(doc, 'div', { className: 'lms-header-actions' });
        actions.appendChild(createButton(doc, 'lms-refresh-btn', '새로고침', 'btn btn-default btn-outline-secondary lms-btn', state.handlers.onRefresh, false, '대시보드 새로고침'));
        actions.appendChild(createButton(doc, 'lms-home-btn', 'LMS 홈으로 복귀', 'btn btn-default btn-outline-secondary lms-btn', state.handlers.onHome, false, '기존 LMS 홈 보기'));
        header.appendChild(actions);
        mount.appendChild(header);

        const warningCard = createWarningList(doc, state.warnings);
        if (warningCard) mount.appendChild(warningCard);

        if (state.courseNames.length) {
            const courseList = createElement(doc, 'div', { className: 'lms-card lms-course-list' });
            courseList.appendChild(createElement(doc, 'span', { className: 'lms-course-list-label', text: '불러온 강좌 (' + state.courseNames.length + ')' }));
            const chips = createElement(doc, 'div', { className: 'lms-course-chips' });
            state.courseNames.forEach((course) => {
                chips.appendChild(createElement(doc, 'a', {
                    className: 'lms-course-chip',
                    text: course.courseName,
                    attrs: { href: '/course/view.php?id=' + course.courseId, target: '_blank', rel: 'noopener noreferrer' }
                }));
            });
            courseList.appendChild(chips);
            mount.appendChild(courseList);
        }

        const weekCard = createElement(doc, 'div', { className: 'lms-card lms-week-card' });
        const weekNav = createElement(doc, 'div', { className: 'lms-week-nav' });
        weekNav.appendChild(createButton(doc, 'dash-prev-btn', '<', 'lms-nav-btn', state.handlers.onPrev, !state.canPrev, '이전 주차'));
        const center = createElement(doc, 'div', { className: 'lms-week-center' });
        center.appendChild(createElement(doc, 'h3', { className: 'lms-week-title', text: core.getWeekLabel(state.week) }));
        center.appendChild(createElement(doc, 'div', { className: 'lms-period-badge', text: state.periodStr || '기간 정보 없음' }));
        weekNav.appendChild(center);
        weekNav.appendChild(createButton(doc, 'dash-next-btn', '>', 'lms-nav-btn', state.handlers.onNext, !state.canNext, '다음 주차'));
        weekCard.appendChild(weekNav);
        mount.appendChild(weekCard);

        mount.appendChild(buildTable(doc, '전체 학습 자료 및 활동 (통합본)', '📁', [
            { text: '과목명', className: 'lms-th-center', attrs: { style: 'width:20%' } },
            { text: '유형', attrs: { style: 'width:10%' } },
            { text: '자료 / 활동명', className: 'lms-th-left', attrs: { style: 'width:35%' } },
            { text: '기간 / 상세 정보', attrs: { style: 'width:25%' } },
            { text: '이수 여부', attrs: { style: 'width:10%' } }
        ], createActivityRows(doc, state.activities, state.baseUrl, false), false));

        const incompleteCard = createElement(doc, 'div', { className: 'lms-card lms-incomplete-card' });
        if (state.incActivities.length) {
            incompleteCard.appendChild(createElement(doc, 'h4', { className: 'lms-incomplete-title', text: '🚨 미수강 및 미제출 항목 (전체 주차 통합)' }));
            incompleteCard.appendChild(buildTable(doc, '', '', [
                { text: '과목명', className: 'lms-th-center', attrs: { style: 'width:20%' } },
                { text: '해당 주차', attrs: { style: 'width:10%' } },
                { text: '유형', attrs: { style: 'width:10%' } },
                { text: '자료 / 활동명', className: 'lms-th-left', attrs: { style: 'width:30%' } },
                { text: '기간 / 상세 정보', attrs: { style: 'width:20%' } },
                { text: '이수 여부', attrs: { style: 'width:10%' } }
            ], createActivityRows(doc, state.incActivities, state.baseUrl, true), true));
        } else {
            incompleteCard.appendChild(createElement(doc, 'h3', { className: 'lms-all-complete', text: '🎉 모든 주차의 수강을 완료하고 과제를 제출했습니다!' }));
        }
        mount.appendChild(incompleteCard);
        mount.focus();
    }

    return {
        appendSanitizedHtml: appendSanitizedHtml,
        buildHostMount: buildHostMount,
        clearChildren: clearChildren,
        renderDashboard: renderDashboard,
        renderLoading: renderLoading,
        renderMessage: renderMessage,
        restoreHost: restoreHost,
        updateProgress: updateProgress
    };
});
