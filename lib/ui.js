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

    function createSvgElement(doc, tagName, options) {
        const element = doc.createElementNS('http://www.w3.org/2000/svg', tagName);
        const config = options || {};
        if (config.className) element.setAttribute('class', config.className);
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

    function createButton(doc, id, text, className, onClick, disabled, ariaLabel, title) {
        const button = createElement(doc, 'button', {
            className: className,
            text: text,
            attrs: { type: 'button', id: id, 'aria-label': ariaLabel || text, title: title }
        });
        button.disabled = Boolean(disabled);
        if (onClick) button.addEventListener('click', onClick);
        return button;
    }

    function createSvgIcon(doc, className, title, paths, viewBox) {
        const svg = createSvgElement(doc, 'svg', {
            className: className,
            attrs: {
                viewBox: viewBox || '0 0 24 24',
                'aria-hidden': 'true',
                focusable: 'false'
            }
        });
        if (title) svg.appendChild(createSvgElement(doc, 'title', { text: title }));
        paths.forEach(function (path) {
            svg.appendChild(createSvgElement(doc, 'path', { attrs: path }));
        });
        return svg;
    }

    function createIconButton(doc, id, className, onClick, disabled, ariaLabel, icon, useTitleTooltip) {
        const button = createButton(doc, id, '', className, onClick, disabled, ariaLabel, useTitleTooltip ? ariaLabel : null);
        button.appendChild(icon);
        return button;
    }

    function createInfoTooltip(doc) {
        const wrapper = createElement(doc, 'div', { className: 'lms-info-tooltip-wrap' });
        const button = createIconButton(
            doc,
            'lms-info-btn',
            'lms-info-btn-icon',
            null,
            false,
            '표기 기준 안내',
            createSvgIcon(doc, 'lms-icon lms-icon-info', null, [
                { d: 'M12 8.5h.01', fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round', 'stroke-width': '2.2' },
                { d: 'M11 12h1v4h1', fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2.2' },
                { d: 'M12 21a9 9 0 100-18 9 9 0 000 18z', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }
            ]),
            false
        );
        const bubble = createElement(doc, 'div', {
            className: 'lms-info-tooltip',
            attrs: { role: 'tooltip' }
        });
        const items = [
            { tone: 'success', label: '초록 행', description: '완료한 학습 또는 제출한 항목' },
            { tone: 'urgent', label: '빨간 강조 행', description: '마감까지 7일 이하로 남은 미완료 항목' },
            { tone: 'warning', label: '노란 행', description: '아직 시작 기간이 되지 않은 항목' },
            { tone: 'danger', label: '옅은 붉은 행', description: '시작 기간은 지났지만 마감까지 8일 이상 남은 미완료 항목' },
            { tone: 'neutral', label: '흰색 행', description: '파일, 링크, 참고자료처럼 상태 확인 대상이 아닌 항목' }
        ];
        const detailItems = [
            '동영상: 출석/학습 현황 페이지의 요구시간, 누적시간, 완료 여부를 기준으로 판정',
            '과제/퀴즈: 각 강좌의 과제함, 퀴즈 목록, 상세 페이지의 제출/응시 상태를 기준으로 판정',
            '긴급 여부: 마감일이 오늘부터 7일 이내이고 아직 완료되지 않은 경우 강조',
            '시작 전 여부: 기간의 시작일이 오늘 이후로 잡혀 있으면 노란 행으로 표시',
            '기타 주차: MOOC 등 일반 주차로 분류되지 않는 항목을 별도로 묶어 표시'
        ];

        bubble.appendChild(createElement(doc, 'strong', { className: 'lms-info-tooltip-title', text: '표기 기준' }));
        items.forEach(function (item) {
            const row = createElement(doc, 'div', { className: 'lms-info-tooltip-item' });
            row.appendChild(createElement(doc, 'span', {
                className: 'lms-info-tooltip-badge lms-info-tooltip-badge-' + item.tone,
                text: item.label
            }));
            row.appendChild(createElement(doc, 'span', {
                className: 'lms-info-tooltip-desc',
                text: item.description
            }));
            bubble.appendChild(row);
        });
        bubble.appendChild(createElement(doc, 'strong', { className: 'lms-info-tooltip-subtitle', text: '판정 기준 상세' }));
        detailItems.forEach(function (item) {
            bubble.appendChild(createElement(doc, 'div', { className: 'lms-info-tooltip-detail', text: item }));
        });

        wrapper.appendChild(button);
        wrapper.appendChild(bubble);
        return wrapper;
    }

    function getDisplayPeriodText(week, periodStr) {
        if (week === core.OTHER_WEEK_NUM) return '[MOOC 등 기타 강의]';
        return periodStr || '';
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

    function getActivityDateRange(activity) {
        const text = activity.optionsHtml && activity.optionsHtml !== '-' ? activity.optionsHtml : '';
        const periodStr = activity.periodStr || '';
        let startYear, startMonth, startDay;
        let endYear, endMonth, endDay;

        const koreanFullMatch = text.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g);
        if (koreanFullMatch && koreanFullMatch.length > 0) {
            const firstDate = koreanFullMatch[0].match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
            const lastDate = koreanFullMatch[koreanFullMatch.length - 1].match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
            if (firstDate) {
                startYear = parseInt(firstDate[1], 10);
                startMonth = parseInt(firstDate[2], 10);
                startDay = parseInt(firstDate[3], 10);
            }
            if (lastDate) {
                endYear = parseInt(lastDate[1], 10);
                endMonth = parseInt(lastDate[2], 10);
                endDay = parseInt(lastDate[3], 10);
            }
        }

        if (!endYear) {
            const dashDateMatch = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/g);
            if (dashDateMatch && dashDateMatch.length > 0) {
                const firstDate = dashDateMatch[0].match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
                const lastDate = dashDateMatch[dashDateMatch.length - 1].match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
                if (firstDate) {
                    startYear = parseInt(firstDate[1], 10);
                    startMonth = parseInt(firstDate[2], 10);
                    startDay = parseInt(firstDate[3], 10);
                }
                if (lastDate) {
                    endYear = parseInt(lastDate[1], 10);
                    endMonth = parseInt(lastDate[2], 10);
                    endDay = parseInt(lastDate[3], 10);
                }
            }
        }

        if (!endYear) {
            const dotDateMatches = text.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/g);
            if (dotDateMatches && dotDateMatches.length > 0) {
                const firstDate = dotDateMatches[0].match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
                const lastDate = dotDateMatches[dotDateMatches.length - 1].match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
                if (firstDate) {
                    startYear = parseInt(firstDate[1], 10);
                    startMonth = parseInt(firstDate[2], 10);
                    startDay = parseInt(firstDate[3], 10);
                }
                if (lastDate) {
                    endYear = parseInt(lastDate[1], 10);
                    endMonth = parseInt(lastDate[2], 10);
                    endDay = parseInt(lastDate[3], 10);
                }
            }
        }

        const now = new Date();
        if (!endYear && periodStr) {
            const periodMatch = periodStr.match(/~\s*(\d{1,2})\.(\d{1,2})/);
            if (periodMatch) {
                endYear = now.getFullYear();
                endMonth = parseInt(periodMatch[1], 10);
                endDay = parseInt(periodMatch[2], 10);
                if (endMonth < now.getMonth() + 1 - 6) {
                    endYear = now.getFullYear() + 1;
                }
            }
        }

        if (!startYear && endYear) {
            startYear = endYear;
            startMonth = endMonth;
            startDay = endDay;
        }

        if (!endYear || !endMonth || !endDay) return null;

        return {
            start: startYear && startMonth && startDay ? new Date(startYear, startMonth - 1, startDay, 0, 0, 0) : null,
            end: new Date(endYear, endMonth - 1, endDay, 0, 0, 0)
        };
    }

    function getDaysUntilDeadline(activity) {
        const range = getActivityDateRange(activity);
        if (!range || !range.end) return null;

        const now = new Date();
        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const diffTime = range.end - todayMidnight;
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        return diffDays;
    }

    function createActivityRows(doc, activities, baseUrl, includeWeek, _isIncompleteSection) {
        const sorted = activities.slice().sort((left, right) => left.courseName.localeCompare(right.courseName) || left.weekNum - right.weekNum);
        const groupSizes = new Map();
        sorted.forEach((activity) => {
            groupSizes.set(activity.courseId, (groupSizes.get(activity.courseId) || 0) + 1);
        });
        let previousCourseId = null;

        return sorted.map((activity) => {
            const dateRange = getActivityDateRange(activity);
            const daysLeft = getDaysUntilDeadline(activity);
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
        const displayPeriodText = getDisplayPeriodText(state.week, state.periodStr);
        
        // 좌측: 타이틀 + 버전
        const titleWrap = createElement(doc, 'div', { className: 'lms-title-wrap' });
        titleWrap.appendChild(createElement(doc, 'h3', { className: 'lms-title', text: '호서 LMS+' }));
        titleWrap.appendChild(createElement(doc, 'span', { className: 'lms-version-badge', text: 'v1.2.3' }));
        header.appendChild(titleWrap);
        
        // 중앙: 주차 선택기 + 날짜
        const weekNav = createElement(doc, 'div', { className: 'lms-week-nav-inline' });
        weekNav.appendChild(createIconButton(
            doc,
            'dash-prev-btn',
            'lms-nav-btn-large',
            state.handlers.onPrev,
            !state.canPrev,
            '이전 주차',
            createSvgIcon(doc, 'lms-icon lms-icon-arrow', null, [
                { d: 'M14.5 5.5L8 12l6.5 6.5', fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2.2' }
            ]),
            true
        ));
        const weekCenter = createElement(doc, 'div', { className: 'lms-week-center-inline' });
        weekCenter.appendChild(createElement(doc, 'span', { className: 'lms-week-title-large', text: core.getWeekLabel(state.week) }));
        if (displayPeriodText) {
            weekCenter.appendChild(createElement(doc, 'div', { className: 'lms-week-period', text: displayPeriodText }));
        }
        weekNav.appendChild(weekCenter);
        weekNav.appendChild(createIconButton(
            doc,
            'dash-next-btn',
            'lms-nav-btn-large',
            state.handlers.onNext,
            !state.canNext,
            '다음 주차',
            createSvgIcon(doc, 'lms-icon lms-icon-arrow', null, [
                { d: 'M9.5 5.5L16 12l-6.5 6.5', fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2.2' }
            ]),
            true
        ));
        header.appendChild(weekNav);
        
        // 우측: 새로고침 버튼
        const actions = createElement(doc, 'div', { className: 'lms-header-actions' });
        actions.appendChild(createInfoTooltip(doc));
        actions.appendChild(createIconButton(
            doc,
            'lms-refresh-btn',
            'lms-refresh-btn-icon',
            state.handlers.onRefresh,
            false,
            '새로고침',
            createSvgIcon(doc, 'lms-icon lms-icon-refresh', null, [
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
            const iconWrap = createElement(doc, 'div', { className: 'lms-complete-icon' });
            iconWrap.appendChild(createSvgIcon(doc, 'lms-icon lms-icon-check', null, [
                { d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z', fill: '#e8f5e9', stroke: 'none' },
                { d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z', fill: 'none', stroke: '#28a745', 'stroke-width': '1.5' },
                { d: 'M8 12l2.5 2.5L16 9', fill: 'none', stroke: '#28a745', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2.5' }
            ]));
            completeCard.appendChild(iconWrap);
            const textWrap = createElement(doc, 'div', { className: 'lms-complete-text-wrap' });
            textWrap.appendChild(createElement(doc, 'div', { className: 'lms-all-complete', text: '모든 학습을 완료했습니다!' }));
            textWrap.appendChild(createElement(doc, 'div', { className: 'lms-complete-sub', text: '이번 주차 학습을 모두 마치셨습니다. 잘 하셨어요!' }));
            completeCard.appendChild(textWrap);
            mount.appendChild(completeCard);
        }

        const footer = createElement(doc, 'div', { className: 'lms-dashboard-footer' });
        const footerText = createElement(doc, 'small', { className: 'lms-dashboard-footer-text' });
        footerText.appendChild(createElement(doc, 'span', {
            className: 'lms-dashboard-footer-line',
            text: '본 프로그램 사용으로 인한 모든 책임은 사용자에게 있습니다.'
        }));
        const contactLine = createElement(doc, 'span', { className: 'lms-dashboard-footer-line' });
        contactLine.appendChild(doc.createTextNode('기타 문의는 '));
        contactLine.appendChild(createElement(doc, 'a', {
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
