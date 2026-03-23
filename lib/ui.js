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

    function getDaysUntilDeadline(activity) {
        const text = activity.optionsHtml && activity.optionsHtml !== '-' ? activity.optionsHtml : '';
        const periodStr = activity.periodStr || '';
        let year, month, day;
        
        const endDateMatch = text.match(/(?:~|종료|마감)[^\d]*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
        if (endDateMatch) {
            year = parseInt(endDateMatch[1], 10);
            month = parseInt(endDateMatch[2], 10);
            day = parseInt(endDateMatch[3], 10);
        } else {
            const koreanFullMatch = text.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g);
            if (koreanFullMatch && koreanFullMatch.length > 0) {
                const lastDate = koreanFullMatch[koreanFullMatch.length - 1];
                const parsed = lastDate.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
                if (parsed) {
                    year = parseInt(parsed[1], 10);
                    month = parseInt(parsed[2], 10);
                    day = parseInt(parsed[3], 10);
                }
            }
        }
        
        if (!year) {
            const dashDateMatch = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/g);
            if (dashDateMatch && dashDateMatch.length > 0) {
                const lastDate = dashDateMatch[dashDateMatch.length - 1];
                const parsed = lastDate.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
                if (parsed) {
                    year = parseInt(parsed[1], 10);
                    month = parseInt(parsed[2], 10);
                    day = parseInt(parsed[3], 10);
                }
            }
        }
        
        if (!year) {
            const dotDateMatch = text.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
            if (dotDateMatch) {
                year = parseInt(dotDateMatch[1], 10);
                month = parseInt(dotDateMatch[2], 10);
                day = parseInt(dotDateMatch[3], 10);
            }
        }
        
        const now = new Date();
        if (!year && periodStr) {
            const periodMatch = periodStr.match(/~\s*(\d{1,2})\.(\d{1,2})/);
            if (periodMatch) {
                year = now.getFullYear();
                month = parseInt(periodMatch[1], 10);
                day = parseInt(periodMatch[2], 10);
                if (month < now.getMonth() + 1 - 6) {
                    year = now.getFullYear() + 1;
                }
            }
        }
        
        if (!year || !month || !day) return null;
        
        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const deadlineMidnight = new Date(year, month - 1, day, 0, 0, 0);
        const diffTime = deadlineMidnight - todayMidnight;
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays;
    }

    function createActivityRows(doc, activities, baseUrl, includeWeek, isIncompleteSection) {
        const sorted = activities.slice().sort((left, right) => left.courseName.localeCompare(right.courseName) || left.weekNum - right.weekNum);
        const groupSizes = new Map();
        sorted.forEach((activity) => {
            groupSizes.set(activity.courseId, (groupSizes.get(activity.courseId) || 0) + 1);
        });
        let previousCourseId = null;

        return sorted.map((activity) => {
            const daysLeft = getDaysUntilDeadline(activity);
            const isUrgent = daysLeft !== null && daysLeft <= 5 && daysLeft >= 0 && !activity.isCompleted;
            
            let rowClass;
            if (activity.isNeutral) {
                rowClass = 'lms-row-neutral';
            } else if (activity.isCompleted) {
                rowClass = 'lms-row-success';
            } else if (isUrgent) {
                rowClass = 'lms-row-urgent';
            } else {
                rowClass = isIncompleteSection ? 'lms-row-neutral' : 'lms-row-danger';
            }
            
            const row = createElement(doc, 'tr', { className: rowClass });
            const isFirst = activity.courseId !== previousCourseId;
            previousCourseId = activity.courseId;

            const courseCell = createCourseCell(doc, activity, groupSizes.get(activity.courseId), isFirst);
            if (courseCell) row.appendChild(courseCell);
            
            if (includeWeek) {
                row.appendChild(createElement(doc, 'td', { className: 'lms-td-week', text: core.getWeekLabel(activity.weekNum) }));
            }
            
            row.appendChild(createElement(doc, 'td', { text: activity.type || '-' }));

            const nameCell = createElement(doc, 'td', { className: 'lms-td-left' + (isUrgent ? ' lms-urgent-text' : '') });
            if (activity.href && activity.nameHtml && activity.nameHtml !== '-') {
                const anchor = createElement(doc, 'a', { attrs: { href: activity.href, target: '_blank', rel: 'noopener noreferrer' } });
                appendSanitizedHtml(anchor, activity.nameHtml, baseUrl);
                nameCell.appendChild(anchor);
            } else {
                appendSanitizedHtml(nameCell, activity.nameHtml || '-', baseUrl);
            }
            row.appendChild(nameCell);

            // 기간/상세 정보 셀 - urgent일 때 텍스트 빨간색
            const optionsCell = createHtmlCell(doc, 'lms-td-options', activity.optionsHtml || '-', baseUrl);
            row.appendChild(optionsCell);
            
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
        
        // 좌측: 타이틀 + 버전
        const titleWrap = createElement(doc, 'div', { className: 'lms-title-wrap' });
        titleWrap.appendChild(createElement(doc, 'h3', { className: 'lms-title', text: '호서 LMS+' }));
        titleWrap.appendChild(createElement(doc, 'span', { className: 'lms-version-badge', text: 'v1.2.1' }));
        header.appendChild(titleWrap);
        
        // 중앙: 주차 선택기 + 날짜
        const weekNav = createElement(doc, 'div', { className: 'lms-week-nav-inline' });
        weekNav.appendChild(createButton(doc, 'dash-prev-btn', '‹', 'lms-nav-btn-large', state.handlers.onPrev, !state.canPrev, '이전 주차'));
        const weekCenter = createElement(doc, 'div', { className: 'lms-week-center-inline' });
        weekCenter.appendChild(createElement(doc, 'span', { className: 'lms-week-title-large', text: core.getWeekLabel(state.week) }));
        if (state.periodStr) {
            weekCenter.appendChild(createElement(doc, 'div', { className: 'lms-week-period', text: state.periodStr }));
        }
        weekNav.appendChild(weekCenter);
        weekNav.appendChild(createButton(doc, 'dash-next-btn', '›', 'lms-nav-btn-large', state.handlers.onNext, !state.canNext, '다음 주차'));
        header.appendChild(weekNav);
        
        // 우측: 새로고침 버튼
        const actions = createElement(doc, 'div', { className: 'lms-header-actions' });
        actions.appendChild(createButton(doc, 'lms-refresh-btn', '↻', 'lms-refresh-btn-icon', state.handlers.onRefresh, false, '새로고침'));
        header.appendChild(actions);
        
        mount.appendChild(header);

        const warningCard = createWarningList(doc, state.warnings);
        if (warningCard) mount.appendChild(warningCard);

        if (state.courseNames.length) {
            const courseList = createElement(doc, 'div', { className: 'lms-card lms-course-list' });
            const courseNameList = state.courseNames.map(c => c.courseName).join(', ');
            const labelSpan = createElement(doc, 'span', { 
                className: 'lms-course-list-label', 
                text: '불러온 강좌 (' + state.courseNames.length + '개) : ' 
            });
            const namesSpan = createElement(doc, 'span', { 
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
        ], createActivityRows(doc, state.activities, state.baseUrl, false, false), false));

        if (state.incActivities.length) {
            mount.appendChild(buildTable(doc, '미완료 항목', '', [
                { text: '과목명', className: 'lms-th-center', attrs: { style: 'width:20%' } },
                { text: '주차', attrs: { style: 'width:10%' } },
                { text: '유형', attrs: { style: 'width:10%' } },
                { text: '자료 / 활동명', className: 'lms-th-left', attrs: { style: 'width:30%' } },
                { text: '기간', attrs: { style: 'width:20%' } },
                { text: '이수', attrs: { style: 'width:10%' } }
            ], createActivityRows(doc, state.incActivities, state.baseUrl, true, true), true));
        } else {
            const completeCard = createElement(doc, 'div', { className: 'lms-card lms-all-complete-card' });
            completeCard.appendChild(createElement(doc, 'span', { className: 'lms-all-complete', text: '모든 학습을 완료했습니다' }));
            mount.appendChild(completeCard);
        }
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
