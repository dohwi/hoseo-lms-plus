(function (global, factory) {
    const exports = factory(global.HoseoLmsPlusCore);
    global.HoseoLmsPlusParsers = exports;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = exports;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core) {
    'use strict';

    const OTHER_WEEK_NUM = core.OTHER_WEEK_NUM;

    function parseDocument(html) {
        if (typeof DOMParser !== 'undefined') {
            return new DOMParser().parseFromString(html, 'text/html');
        }
        const jsdom = require('jsdom');
        return new jsdom.JSDOM(html).window.document;
    }

    function parseAttendancePage(html, courseId, baseUrl) {
        const doc = parseDocument(html);
        const items = [];
        const courseName = core.normalizeText(doc.title.replace('학습관리시스템(LMS)', '').replace(/\s*\(\d+\)$/, '')) || ('강좌 ' + courseId);
        const periodMap = {};

        Array.from(doc.querySelectorAll('#modal-coursemos-sections .section-item a')).forEach((link) => {
            const title = link.getAttribute('title') || link.textContent || '';
            const match = title.match(/(\d+)주차\s*(\[[^\]]+\])/);
            if (match) periodMap[match[1]] = match[2];
        });

        const table = core.queryWithFallback(doc, core.SELECTORS.attendanceTable);
        if (!table) return { items: items, courseName: courseName, periodMap: periodMap };

        table.querySelectorAll('button').forEach((button) => { button.remove(); });
        table.querySelectorAll('a').forEach((anchor) => { anchor.removeAttribute('onclick'); });

        let currentWeekNum = null;
        let currentPeriod = null;
        Array.from(table.querySelectorAll('tbody tr')).forEach(function (row) {
            const cells = row.querySelectorAll(':scope > td');
            const length = cells.length;
            if (!length) return;

            let materialCell;
            let reqTimeCell;
            let readTimeCell;
            let statusCell;

            if (length === 7 || length === 6) {
                const parsedWeekNum = Number.parseInt(core.normalizeText(cells[0].textContent), 10);
                if (length === 7) {
                    currentWeekNum = Number.isFinite(parsedWeekNum) ? parsedWeekNum : OTHER_WEEK_NUM;
                    currentPeriod = currentWeekNum === OTHER_WEEK_NUM ? '기타' : (periodMap[currentWeekNum] || '');
                    materialCell = cells[1];
                    reqTimeCell = cells[2];
                    readTimeCell = cells[4];
                    statusCell = cells[5];
                } else {
                    currentWeekNum = OTHER_WEEK_NUM;
                    currentPeriod = '기타';
                    materialCell = cells[1];
                    reqTimeCell = cells[2];
                    readTimeCell = cells[4];
                    statusCell = cells[5];
                }
            } else if (length === 5) {
                if (currentWeekNum === null) {
                    currentWeekNum = OTHER_WEEK_NUM;
                    currentPeriod = '기타';
                }
                materialCell = cells[0];
                reqTimeCell = cells[1];
                readTimeCell = cells[3];
                statusCell = cells[4];
            } else {
                return;
            }

            const materialHtml = core.sanitizeHtmlToString(doc, materialCell.innerHTML.replace(/&nbsp;/g, '').trim(), { baseUrl: baseUrl });
            if (!core.stripHtml(materialHtml)) return;
            const materialHref = core.extractFirstSafeHref(doc, materialCell.innerHTML, baseUrl);

            const statusText = core.normalizeText(statusCell.textContent).toUpperCase();
            items.push({
                courseId: courseId,
                courseName: courseName,
                weekNum: currentWeekNum,
                periodStr: currentPeriod,
                materialHref: materialHref,
                materialHtml: materialHtml,
                reqTimeHtml: core.sanitizeHtmlToString(doc, reqTimeCell.innerHTML, { baseUrl: baseUrl }),
                readTimeHtml: core.sanitizeHtmlToString(doc, readTimeCell.innerHTML, { baseUrl: baseUrl }),
                statusHtml: core.sanitizeHtmlToString(doc, statusCell.innerHTML, { baseUrl: baseUrl }),
                isCompleted: statusText.includes('O') || statusText.includes('100%') || statusText.includes('완료')
            });
        });

        return { items: items, courseName: courseName, periodMap: periodMap };
    }

    function parseAssignmentIndexPage(html, courseId, courseName, periodMap, baseUrl) {
        const doc = parseDocument(html);
        const assignTable = core.queryWithFallback(doc, core.SELECTORS.activityTable);
        const assignments = [];
        let currentWeekNum = null;
        let currentPeriod = null;
        if (!assignTable) return assignments;

        Array.from(assignTable.querySelectorAll('tr')).forEach((row) => {
            if (row.querySelector('th') && !row.querySelector('td')) return;
            const cells = row.querySelectorAll(':scope > td');
            if (cells.length < 3) return;
            const firstCellText = core.normalizeText(cells[0].textContent);
            const weekMatch = firstCellText.match(/(\d+)\s*(주|회|Week)/i) || (/^\d+$/.test(firstCellText) ? firstCellText.match(/(\d+)/) : null);
            const isWeekCell = Boolean(weekMatch);
            const isContinuationRow = !firstCellText && cells.length >= 5;
            const isSectionHeader = firstCellText && !isWeekCell && cells.length >= 5;
            const titleIndex = (isWeekCell || isContinuationRow || isSectionHeader) ? 1 : 0;

            if (isWeekCell) {
                currentWeekNum = Number.parseInt(weekMatch[1], 10);
                const periodMatch = firstCellText.match(/(\[[^\]]+\])/);
                currentPeriod = periodMatch ? periodMatch[1] : (periodMap[currentWeekNum] || '');
            } else if (!currentWeekNum) {
                currentWeekNum = OTHER_WEEK_NUM;
                currentPeriod = '기타';
            }

            const titleCell = cells[titleIndex];
            const dueCell = cells[titleIndex + 1];
            const submitCell = cells[titleIndex + 2];
            const gradeCell = cells[titleIndex + 3];
            if (!titleCell || !core.normalizeText(titleCell.textContent)) return;

            const link = titleCell.querySelector('a');
            const rawHref = link ? link.getAttribute('href') : null;
            const viewUrl = rawHref && core.isSafeUrl(rawHref, baseUrl)
                ? new URL(rawHref, baseUrl).toString()
                : null;
            assignments.push({
                courseId: courseId,
                courseName: courseName,
                weekNum: currentWeekNum,
                periodStr: currentPeriod,
                activityKey: core.getActivityIdentifier(viewUrl, baseUrl),
                titleHtml: core.sanitizeHtmlToString(doc, titleCell.innerHTML, { baseUrl: baseUrl }),
                dueDateHtml: dueCell ? core.sanitizeHtmlToString(doc, dueCell.innerHTML, { baseUrl: baseUrl }) : '-',
                submitHtml: submitCell ? core.sanitizeHtmlToString(doc, submitCell.innerHTML, { baseUrl: baseUrl }) : '-',
                submitText: submitCell ? core.normalizeText(submitCell.textContent) : '',
                gradeHtml: gradeCell ? core.sanitizeHtmlToString(doc, gradeCell.innerHTML, { baseUrl: baseUrl }) : '-',
                viewUrl: viewUrl,
                isCompleted: submitCell ? core.normalizeText(submitCell.textContent).includes('제출 완료') : false
            });
        });
        return assignments;
    }

    function parseQuizIndexPage(html, courseId, courseName, periodMap, baseUrl) {
        const doc = parseDocument(html);
        const quizTable = core.queryWithFallback(doc, core.SELECTORS.quizTable);
        const quizzes = [];
        let currentWeekNum = null;
        let currentPeriod = null;
        if (!quizTable) return quizzes;

        Array.from(quizTable.querySelectorAll('tbody tr')).forEach((row) => {
            const cells = row.querySelectorAll(':scope > td');
            if (cells.length < 4) return;
            const firstCellText = core.normalizeText(cells[0].textContent);
            const weekMatch = firstCellText.match(/(\d+)\s*(주|회|Week)/i);
            const isWeekCell = Boolean(weekMatch);
            const isContinuationRow = !firstCellText && cells.length >= 4;
            const isSectionHeader = firstCellText && !isWeekCell && cells.length >= 4;
            const titleIndex = (isWeekCell || isContinuationRow || isSectionHeader) ? 1 : 0;

            if (isWeekCell) {
                currentWeekNum = Number.parseInt(weekMatch[1], 10);
                const periodMatch = firstCellText.match(/(\[[^\]]+\])/);
                currentPeriod = periodMatch ? periodMatch[1] : (periodMap[currentWeekNum] || '');
            } else if (!currentWeekNum) {
                currentWeekNum = OTHER_WEEK_NUM;
                currentPeriod = '기타';
            }

            const titleCell = cells[titleIndex];
            const dueCell = cells[titleIndex + 1];
            const gradeCell = cells[cells.length - 1];
            if (!titleCell || !core.normalizeText(titleCell.textContent)) return;

            const anchor = titleCell.querySelector('a');
            const rawHref = anchor ? anchor.getAttribute('href') : null;
            const viewUrl = rawHref && core.isSafeUrl(rawHref, baseUrl + '/mod/quiz/')
                ? new URL(rawHref, baseUrl + '/mod/quiz/').toString()
                : null;
            const gradeText = gradeCell ? core.normalizeText(gradeCell.textContent) : '';

            quizzes.push({
                courseId: courseId,
                courseName: courseName,
                weekNum: currentWeekNum,
                periodStr: currentPeriod,
                activityKey: core.getActivityIdentifier(viewUrl, baseUrl),
                titleHtml: core.sanitizeHtmlToString(doc, titleCell.innerHTML, { baseUrl: baseUrl }),
                dueDateHtml: dueCell ? core.sanitizeHtmlToString(doc, dueCell.innerHTML, { baseUrl: baseUrl }) : '-',
                gradeHtml: gradeCell ? core.sanitizeHtmlToString(doc, gradeCell.innerHTML, { baseUrl: baseUrl }) : '-',
                gradeText: gradeText,
                viewUrl: viewUrl,
                isCompleted: gradeText !== '' && gradeText !== '-'
            });
        });
        return quizzes;
    }

    function parseQuizAttemptStatus(html) {
        const doc = parseDocument(html);
        const details = doc.querySelector('.quizattemptsummary .statedetails');
        if (details) {
            const text = core.normalizeText(details.textContent);
            if (text.includes('제출됨') || text.includes('종료')) {
                return { isCompleted: true, finalStatusText: text };
            }
        }
        const summary = doc.querySelector('.quizattemptsummary');
        if (summary && (summary.textContent.includes('제출됨') || summary.textContent.includes('종료됨'))) {
            return { isCompleted: true, finalStatusText: '제출됨' };
        }
        if (html.includes('퀴즈 재응시') || html.includes('re-attempt')) {
            return { isCompleted: true, finalStatusText: '응시 완료' };
        }
        return { isCompleted: false, finalStatusText: '미응시' };
    }

    function isCourseNoticeUrl(url, baseUrl) {
        if (!url || !core.isSafeUrl(url, baseUrl)) return false;
        try {
            const expectedBase = new URL(baseUrl || core.DEFAULT_BASE_URL);
            const parsed = new URL(url, expectedBase);
            return parsed.origin === expectedBase.origin &&
                parsed.pathname === '/mod/ubboard/view.php' &&
                Boolean(parsed.searchParams.get('id'));
        } catch {
            return false;
        }
    }

    function parseNoticePostedDate(row, titleLink, now) {
        const current = now instanceof Date ? now : new Date();
        const candidates = Array.from(row.querySelectorAll('time, .date, .posted-date, .time, [class*="date"], [class*="time"], td, span'))
            .filter(function (element) { return element !== titleLink && !element.contains(titleLink); })
            .reverse();

        for (const element of candidates) {
            const normalized = core.normalizeText(element.getAttribute('datetime') || element.textContent);
            const fullMatch = normalized.match(/((?:19|20)\d{2}|\d{2})\s*(?:[.\-/년])\s*(\d{1,2})\s*(?:[.\-/월])\s*(\d{1,2})\s*(?:일)?/);
            const shortMatch = !fullMatch && normalized.match(/^(\d{1,2})\s*(?:[.\-/월])\s*(\d{1,2})\s*(?:일)?(?:\s+\d{1,2}:\d{2})?$/);
            if (!fullMatch && !shortMatch) continue;
            let year = fullMatch ? Number.parseInt(fullMatch[1], 10) : current.getFullYear();
            if (year < 100) year += 2000;
            const month = Number.parseInt((fullMatch || shortMatch)[fullMatch ? 2 : 1], 10);
            const day = Number.parseInt((fullMatch || shortMatch)[fullMatch ? 3 : 2], 10);
            const date = new Date(year, month - 1, day);
            if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) continue;
            return {
                year: year,
                month: month,
                day: day,
                display: String(month).padStart(2, '0') + '.' + String(day).padStart(2, '0')
            };
        }
        return null;
    }

    function getWeekForNoticeDate(postedDate, periodMap, now) {
        if (!postedDate) return OTHER_WEEK_NUM;
        const current = now instanceof Date ? now : new Date();
        const isPreviousDecember = current.getMonth() === 0 && postedDate.year === current.getFullYear() - 1 && postedDate.month === 12;
        if (postedDate.year !== current.getFullYear() && !isPreviousDecember) return OTHER_WEEK_NUM;
        const postedValue = postedDate.month * 100 + postedDate.day;
        const matchingWeek = Object.keys(periodMap || {}).find(function (week) {
            const dates = String(periodMap[week]).match(/(\d{1,2})\D+(\d{1,2})\D+(\d{1,2})\D+(\d{1,2})/);
            if (!dates) return false;
            const start = Number.parseInt(dates[1], 10) * 100 + Number.parseInt(dates[2], 10);
            const end = Number.parseInt(dates[3], 10) * 100 + Number.parseInt(dates[4], 10);
            return start <= end
                ? postedValue >= start && postedValue <= end
                : postedValue >= start || postedValue <= end;
        });
        return matchingWeek ? Number.parseInt(matchingWeek, 10) : OTHER_WEEK_NUM;
    }

    function isNoticePostUrl(url, baseUrl) {
        if (!url || !core.isSafeUrl(url, baseUrl)) return false;
        try {
            const expectedBase = new URL(baseUrl || core.DEFAULT_BASE_URL);
            const parsed = new URL(url, expectedBase);
            const postParams = ['articleid', 'bwid', 'postid', 'contentid', 'idx', 'wr_id'];
            const hasPostId = postParams.some(function (key) { return Boolean(parsed.searchParams.get(key)); });
            const isReadPath = parsed.pathname === '/mod/ubboard/read.php' && hasPostId;
            const isArticleView = parsed.pathname === '/mod/ubboard/view.php' && hasPostId;
            return parsed.origin === expectedBase.origin && (isReadPath || isArticleView);
        } catch {
            return false;
        }
    }

    function parseUbboardNoticePage(html, courseId, courseName, periodMap, baseUrl, now) {
        const doc = parseDocument(html);
        const notices = [];
        const seen = new Set();
        const rows = Array.from(doc.querySelectorAll([
            '.ubboard-list tbody tr', '.board-list tbody tr', '.generaltable tbody tr',
            'table tbody tr', '.ubboard-list li', '.board-list li', '.list-group-item',
            '.ubboard-list-item', '.board-item', 'article'
        ].join(',')));

        rows.forEach(function (row) {
            const links = Array.from(row.querySelectorAll('a[href]'));
            const link = links.find(function (anchor) {
                const href = anchor.getAttribute('href') || '';
                return isNoticePostUrl(href, baseUrl) && core.normalizeText(anchor.textContent);
            });
            if (!link) return;

            const href = new URL(link.getAttribute('href'), baseUrl).toString();
            if (seen.has(href)) return;
            const postedDate = parseNoticePostedDate(row, link, now);
            if (!postedDate) return;
            seen.add(href);

            const weekNum = getWeekForNoticeDate(postedDate, periodMap, now);
            if (weekNum === OTHER_WEEK_NUM) return;
            notices.push({
                courseId: courseId,
                courseName: courseName,
                weekNum: weekNum,
                periodStr: weekNum === OTHER_WEEK_NUM ? '기타' : (periodMap[weekNum] || ''),
                type: '공지사항',
                href: href,
                nameHtml: core.sanitizeHtmlToString(doc, link.innerHTML, { baseUrl: baseUrl }),
                optionsHtml: postedDate.display,
                statusText: '-',
                isCompleted: false,
                isNeutral: true
            });
        });
        return notices;
    }

    function parseCourseViewPage(html, courseId, courseName, periodMap, baseUrl) {
        const doc = parseDocument(html);
        const activities = [];
        Array.from(doc.querySelectorAll('li.section.main, ul.weeks > li.section, li.section')).forEach((section) => {
            const titleElement = section.querySelector('h3.sectionname');
            if (!titleElement) return;
            const sectionTitle = core.normalizeText(titleElement.textContent);
            const weekMatch = sectionTitle.match(/(\d+)주차/);
            const weekNum = weekMatch ? Number.parseInt(weekMatch[1], 10) : OTHER_WEEK_NUM;
            const periodMatch = sectionTitle.match(/(\[[^\]]+\])/);
            const periodStr = weekMatch ? (periodMatch ? periodMatch[1] : (periodMap[weekNum] || '')) : '기타';

            Array.from(section.querySelectorAll('li.activity')).forEach((activityElement) => {
                const iconElement = activityElement.querySelector('.activityicon');
                const type = iconElement ? iconElement.alt : '기타';
                const link = activityElement.querySelector('a.aalink');
                if (!link) return;

                link.querySelectorAll('.accesshide').forEach((hidden) => { hidden.remove(); });
                const options = activityElement.querySelector('.displayoptions');
                const completionBadge = activityElement.querySelector('.badge-completion');
                const completionTitle = completionBadge ? completionBadge.getAttribute('title') || '' : '';
                const href = link.getAttribute('href') || '#';

                const safeHref = core.isSafeUrl(href, baseUrl)
                    ? new URL(href, baseUrl).toString()
                    : '#';
                const isCourseNotice = isCourseNoticeUrl(safeHref, baseUrl);
                activities.push({
                    courseId: courseId,
                    courseName: courseName,
                    weekNum: weekNum,
                    periodStr: periodStr,
                    activityKey: core.getActivityIdentifier(safeHref === '#' ? null : safeHref, baseUrl),
                    type: type,
                    nameHtml: core.sanitizeHtmlToString(doc, link.innerHTML, { baseUrl: baseUrl }),
                    optionsHtml: options ? core.sanitizeHtmlToString(doc, options.innerHTML, { baseUrl: baseUrl }) : '',
                    href: safeHref,
                    completionTitle: completionTitle,
                    isCourseNotice: isCourseNotice,
                    isIgnoredType: isCourseNotice || type.includes('파일') || type.includes('토론') || type.includes('File') || type.includes('Forum')
                });
            });
        });
        return activities;
    }

    return {
        parseAssignmentIndexPage: parseAssignmentIndexPage,
        parseAttendancePage: parseAttendancePage,
        parseCourseViewPage: parseCourseViewPage,
        parseQuizAttemptStatus: parseQuizAttemptStatus,
        parseUbboardNoticePage: parseUbboardNoticePage,
        parseQuizIndexPage: parseQuizIndexPage
    };
});
