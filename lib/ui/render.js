(function (global, factory) {
    const elements = global.HoseoLmsPlusUiElements;
    const dates = global.HoseoLmsPlusUiDates;
    const tooltip = global.HoseoLmsPlusUiTooltip;
    const exports = factory(global.HoseoLmsPlusCore, elements, dates, tooltip);
    global.HoseoLmsPlusUiRender = exports;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = exports;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core, elements, dates, tooltip) {
    'use strict';

    function getDisplayPeriodText(week, periodStr) {
        if (week === core.OTHER_WEEK_NUM) return '[MOOC 등 기타 강의]';
        return periodStr || '';
    }

    function buildHostMount(doc) {
        const host = core.SELECTORS.mainHosts.map(function (selector) { return doc.querySelector(selector); }).find(Boolean) || doc.body;
        let mount = doc.getElementById(core.SELECTORS.dashboardMountId);
        if (mount) return { mount: mount, host: host };

        mount = elements.createElement(doc, 'section', {
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
        elements.clearChildren(mount);
        const card = elements.createElement(doc, 'div', { className: 'lms-card lms-loading' });
        card.appendChild(elements.createElement(doc, 'h3', { className: 'lms-loading-title', text: '출석 정보를 불러오고 있습니다...' }));
        const progressContainer = elements.createElement(doc, 'div', { className: 'lms-progress-container' });
        progressContainer.appendChild(elements.createElement(doc, 'div', { className: 'lms-progress-bar', attrs: { id: 'lms-progress-bar' } }));
        card.appendChild(progressContainer);
        card.appendChild(elements.createElement(doc, 'p', { className: 'lms-loading-sub', text: '잠시만 기다려주세요.', attrs: { id: 'lms-loading-text', 'aria-live': 'polite' } }));
        mount.appendChild(card);
    }

    function renderMessage(doc, mount, title, body, actions, tone) {
        elements.clearChildren(mount);
        const card = elements.createElement(doc, 'div', { className: 'lms-card lms-message-card' + (tone ? ' ' + tone : '') });
        card.appendChild(elements.createElement(doc, 'h3', { className: 'lms-message-title', text: title }));
        if (body) card.appendChild(elements.createElement(doc, 'p', { className: 'lms-message-body', text: body }));
        const row = elements.createElement(doc, 'div', { className: 'lms-message-actions' });
        (actions || []).forEach(function (action) {
            row.appendChild(elements.createButton(doc, action.id, action.text, action.className || 'btn btn-primary lms-btn', action.onClick));
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
        const card = elements.createElement(doc, 'div', { className: 'lms-card lms-warning-card' });
        card.appendChild(elements.createElement(doc, 'h4', { className: 'lms-warning-title', text: '일부 강좌 정보를 완전히 불러오지 못했습니다.' }));
        const list = elements.createElement(doc, 'ul', { className: 'lms-warning-list' });
        warnings.forEach(function (warning) {
            list.appendChild(elements.createElement(doc, 'li', { text: warning }));
        });
        card.appendChild(list);
        return card;
    }

    function createActivityRows(doc, activities, baseUrl, includeWeek) {
        const sorted = activities.slice().sort(function (left, right) { return left.courseName.localeCompare(right.courseName) || left.weekNum - right.weekNum; });
        const groupSizes = new Map();
        sorted.forEach(function (activity) {
            groupSizes.set(activity.courseId, (groupSizes.get(activity.courseId) || 0) + 1);
        });
        let previousCourseId = null;

        return sorted.map(function (activity) {
            const dateRange = dates.getActivityDateRange(activity);
            const daysLeft = dates.getDaysUntilDeadline(activity);
            const now = new Date();
            const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
            const isNotStarted = Boolean(dateRange && dateRange.start && dateRange.start > todayMidnight && !activity.isCompleted);
            const isUrgent = daysLeft !== null && daysLeft <= 7 && daysLeft >= 0 && !activity.isCompleted;

            let rowClass;
            if (activity.isNeutral) {
                rowClass = 'lms-row-neutral';
            } else if (activity.isCompleted) {
                rowClass = 'lms-row-success';
            } else if (isNotStarted) {
                rowClass = 'lms-row-warning';
            } else if (isUrgent) {
                rowClass = 'lms-row-urgent';
            } else {
                rowClass = 'lms-row-danger';
            }

            const row = elements.createElement(doc, 'tr', { className: rowClass });
            const isFirst = activity.courseId !== previousCourseId;
            previousCourseId = activity.courseId;

            const courseCell = elements.createCourseCell(doc, activity, groupSizes.get(activity.courseId), isFirst);
            if (courseCell) row.appendChild(courseCell);

            if (includeWeek) {
                row.appendChild(elements.createElement(doc, 'td', { className: 'lms-td-week', text: core.getWeekLabel(activity.weekNum) }));
            }

            row.appendChild(elements.createElement(doc, 'td', { text: activity.type || '-' }));

            const nameCell = elements.createElement(doc, 'td', { className: 'lms-td-left' + (isUrgent ? ' lms-urgent-text' : '') });
            if (activity.href && activity.nameHtml && activity.nameHtml !== '-') {
                const anchor = elements.createElement(doc, 'a', { attrs: { href: activity.href, target: '_blank', rel: 'noopener noreferrer' } });
                elements.appendSanitizedHtml(anchor, activity.nameHtml, baseUrl);
                nameCell.appendChild(anchor);
            } else {
                elements.appendSanitizedHtml(nameCell, activity.nameHtml || '-', baseUrl);
            }
            row.appendChild(nameCell);

            const optionsCell = elements.createHtmlCell(doc, 'lms-td-options', activity.optionsHtml || '-', baseUrl);
            row.appendChild(optionsCell);

            const statusCell = elements.createElement(doc, 'td');
            if (activity.isNeutral) {
                statusCell.textContent = '-';
            } else {
                statusCell.appendChild(elements.createElement(doc, 'span', {
                    className: activity.isCompleted ? 'lms-status-ok' : 'lms-status-fail',
                    text: activity.statusText || (activity.isCompleted ? '완료' : '미완료')
                }));
            }
            row.appendChild(statusCell);
            return row;
        });
    }

    function buildTable(doc, title, icon, headers, rows, dangerHead) {
        const wrapper = elements.createElement(doc, 'div', { className: 'lms-table-wrap' });
        if (title) wrapper.appendChild(elements.createElement(doc, 'h4', { className: 'lms-section-title', text: icon + ' ' + title }));
        const table = elements.createElement(doc, 'table', { className: 'table table-bordered table-hover lms-table' });
        const thead = elements.createElement(doc, 'thead');
        const headerRow = elements.createElement(doc, 'tr', { className: dangerHead ? 'lms-thead-danger' : 'lms-thead-row' });
        headers.forEach(function (header) {
            headerRow.appendChild(elements.createElement(doc, 'th', { text: header.text, className: header.className, attrs: header.attrs }));
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);
        const tbody = elements.createElement(doc, 'tbody');
        rows.forEach(function (row) { tbody.appendChild(row); });
        table.appendChild(tbody);
        wrapper.appendChild(table);
        return wrapper;
    }

    function renderDashboard(doc, mount, state) {
        elements.clearChildren(mount);

        const header = elements.createElement(doc, 'div', { className: 'lms-card lms-header' });
        const displayPeriodText = getDisplayPeriodText(state.week, state.periodStr);

        const titleWrap = elements.createElement(doc, 'div', { className: 'lms-title-wrap' });
        titleWrap.appendChild(elements.createElement(doc, 'h3', { className: 'lms-title', text: '호서 LMS+' }));
        if (state.version) {
            titleWrap.appendChild(elements.createElement(doc, 'span', { className: 'lms-version-badge', text: 'v' + state.version }));
        }
        header.appendChild(titleWrap);

        const weekNav = elements.createElement(doc, 'div', { className: 'lms-week-nav-inline' });
        weekNav.appendChild(elements.createIconButton(
            doc,
            'dash-prev-btn',
            'lms-nav-btn-large',
            state.handlers.onPrev,
            !state.canPrev,
            '이전 주차',
            elements.createSvgIcon(doc, 'lms-icon lms-icon-arrow', null, [
                { d: 'M14.5 5.5L8 12l6.5 6.5', fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2.2' }
            ]),
            true
        ));
        const weekCenter = elements.createElement(doc, 'div', { className: 'lms-week-center-inline' });
        weekCenter.appendChild(elements.createElement(doc, 'span', { className: 'lms-week-title-large', text: core.getWeekLabel(state.week) }));
        if (displayPeriodText) {
            weekCenter.appendChild(elements.createElement(doc, 'div', { className: 'lms-week-period', text: displayPeriodText }));
        }
        weekNav.appendChild(weekCenter);
        weekNav.appendChild(elements.createIconButton(
            doc,
            'dash-next-btn',
            'lms-nav-btn-large',
            state.handlers.onNext,
            !state.canNext,
            '다음 주차',
            elements.createSvgIcon(doc, 'lms-icon lms-icon-arrow', null, [
                { d: 'M9.5 5.5L16 12l-6.5 6.5', fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2.2' }
            ]),
            true
        ));
        header.appendChild(weekNav);

        const actions = elements.createElement(doc, 'div', { className: 'lms-header-actions' });
        actions.appendChild(tooltip.createInfoTooltip(doc));
        actions.appendChild(elements.createIconButton(
            doc,
            'lms-refresh-btn',
            'lms-refresh-btn-icon',
            state.handlers.onRefresh,
            false,
            '새로고침',
            elements.createSvgIcon(doc, 'lms-icon lms-icon-refresh', null, [
                { d: 'M19 8a7 7 0 10.85 7.25', fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '1.9' },
                { d: 'M19 3.5v4.8h-4.8', fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '1.9' }
            ]),
            true
        ));
        header.appendChild(actions);

        mount.appendChild(header);

        const warningCard = createWarningList(doc, state.warnings);
        if (warningCard) mount.appendChild(warningCard);

        if (state.courseNames.length) {
            const courseList = elements.createElement(doc, 'div', { className: 'lms-card lms-course-list' });
            const courseNameList = state.courseNames.map(function (c) { return c.courseName; }).join(', ');
            const labelSpan = elements.createElement(doc, 'span', {
                className: 'lms-course-list-label',
                text: '불러온 강좌 (' + state.courseNames.length + '개) : '
            });
            const namesSpan = elements.createElement(doc, 'span', {
                className: 'lms-course-list-names',
                text: courseNameList
            });
            courseList.appendChild(labelSpan);
            courseList.appendChild(namesSpan);
            mount.appendChild(courseList);
        }

        mount.appendChild(buildTable(doc, '전체 학습 자료', '', [
            { text: '과목명', className: 'lms-th-center', attrs: { style: 'width:20%' } },
            { text: '유형', attrs: { style: 'width:10%' } },
            { text: '자료 / 활동명', className: 'lms-th-left', attrs: { style: 'width:35%' } },
            { text: '기간', attrs: { style: 'width:25%' } },
            { text: '이수', attrs: { style: 'width:10%' } }
        ], createActivityRows(doc, state.activities, state.baseUrl, false), false));

        if (state.incActivities.length) {
            mount.appendChild(buildTable(doc, '미완료 항목', '', [
                { text: '과목명', className: 'lms-th-center', attrs: { style: 'width:20%' } },
                { text: '주차', attrs: { style: 'width:10%' } },
                { text: '유형', attrs: { style: 'width:10%' } },
                { text: '자료 / 활동명', className: 'lms-th-left', attrs: { style: 'width:30%' } },
                { text: '기간', attrs: { style: 'width:20%' } },
                { text: '이수', attrs: { style: 'width:10%' } }
            ], createActivityRows(doc, state.incActivities, state.baseUrl, true), true));
        } else {
            const completeCard = elements.createElement(doc, 'div', { className: 'lms-card lms-all-complete-card' });
            const iconWrap = elements.createElement(doc, 'div', { className: 'lms-complete-icon' });
            iconWrap.appendChild(elements.createSvgIcon(doc, 'lms-icon lms-icon-check', null, [
                { d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z', fill: '#e8f5e9', stroke: 'none' },
                { d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z', fill: 'none', stroke: '#28a745', 'stroke-width': '1.5' },
                { d: 'M8 12l2.5 2.5L16 9', fill: 'none', stroke: '#28a745', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2.5' }
            ]));
            completeCard.appendChild(iconWrap);
            const textWrap = elements.createElement(doc, 'div', { className: 'lms-complete-text-wrap' });
            textWrap.appendChild(elements.createElement(doc, 'div', { className: 'lms-all-complete', text: '모든 학습을 완료했습니다!' }));
            textWrap.appendChild(elements.createElement(doc, 'div', { className: 'lms-complete-sub', text: '이번 주차 학습을 모두 마치셨습니다. 잘 하셨어요!' }));
            completeCard.appendChild(textWrap);
            mount.appendChild(completeCard);
        }

        const footer = elements.createElement(doc, 'div', { className: 'lms-dashboard-footer' });
        const footerText = elements.createElement(doc, 'small', { className: 'lms-dashboard-footer-text' });
        footerText.appendChild(elements.createElement(doc, 'span', {
            className: 'lms-dashboard-footer-line',
            text: '본 프로그램 사용으로 인한 모든 책임은 사용자에게 있습니다.'
        }));
        const contactLine = elements.createElement(doc, 'span', { className: 'lms-dashboard-footer-line' });
        contactLine.appendChild(doc.createTextNode('기타 문의는 '));
        contactLine.appendChild(elements.createElement(doc, 'a', {
            className: 'lms-dashboard-footer-link',
            text: 'me@dohwi.com',
            attrs: { href: 'mailto:me@dohwi.com', title: '이메일 보내기' }
        }));
        contactLine.appendChild(doc.createTextNode('으로 부탁드립니다.'));
        footerText.appendChild(contactLine);
        footer.appendChild(footerText);
        mount.appendChild(footer);

        mount.focus();
    }

    return {
        buildHostMount: buildHostMount,
        renderDashboard: renderDashboard,
        renderLoading: renderLoading,
        renderMessage: renderMessage,
        restoreHost: restoreHost,
        updateProgress: updateProgress
    };
});
