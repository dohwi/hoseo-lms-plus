// ===== 호서 LMS+ 대시보드 ======
// 메인 페이지(/ 또는 /index.php)에서만 동작

(() => {
    'use strict';

    const path = window.location.pathname;
    if (path !== '/' && path !== '/index.php') return;

    // ── 상수 ──
    const CACHE_KEY = 'lms_plus_cache_v2';
    const CACHE_TTL = 5 * 60 * 1000; // 5분
    const MAX_TAB_RETRIES = 10;
    const LOGIN_PATTERN = '/login/';
    let savedCourseIds = null;

    // ── 유틸리티 ──
    const stripHtml = (html) => html.replace(/<[^>]*>?/g, '').trim();
    const stripBr = (html) => html.replace(/<br\s*\/?>/gi, '').trim();

    /** XSS 방어: script 태그 제거 */
    const sanitize = (html) => html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    /** 유형 판별 */
    const isVideoType = (type) => type.includes('동영상') || type.includes('VOD') || type.includes('Page');
    const isAssignType = (type) => type.includes('과제') || type.includes('퀴즈') || type.includes('Assignment') || type.includes('Quiz');

    /** 배열을 weekNum 기준으로 Map에 그룹핑 */
    const groupByWeek = (arr) => {
        const map = new Map();
        for (const item of arr) {
            if (!map.has(item.weekNum)) map.set(item.weekNum, []);
            map.get(item.weekNum).push(item);
        }
        return map;
    };

    /** 활동 목록 중복 제거 (courseId + weekNum + nameText 기준) */
    const dedupActivities = (arr) => {
        const seen = new Set();
        const result = [];
        for (const x of arr) {
            const k = `${x.courseId}|${x.weekNum}|${stripHtml(x.nameHtml)}`;
            if (!seen.has(k)) {
                seen.add(k);
                result.push(x);
            }
        }
        return result;
    };

    // ── 캐시 유틸리티 ──
    const getCachedData = () => {
        try {
            const raw = sessionStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const { timestamp, data } = JSON.parse(raw);
            if (Date.now() - timestamp > CACHE_TTL) {
                sessionStorage.removeItem(CACHE_KEY);
                return null;
            }
            return data;
        } catch { return null; }
    };

    const setCachedData = (data) => {
        try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
        } catch { /* full or unavailable */ }
    };

    const getCourseIds = () => {
        const els = document.querySelectorAll('.lists .course');
        const ids = [];
        for (let i = 0; i < els.length; i++) {
            const id = els[i].getAttribute('data-id');
            if (id && !ids.includes(id)) ids.push(id);
        }
        return ids;
    };

    // ── 데이터 Fetch ──
    const fetchCourseData = async (courseId) => {
        const items = [];
        const assigns = [];
        const activities = [];
        let courseTitleStr = `강좌 ${courseId}`;
        let periodMap = {};

        const [attendRes, assignRes, quizRes, viewRes] = await Promise.all([
            fetch(`https://learn.hoseo.ac.kr/local/ubonattend/my_status.php?id=${courseId}`).catch(() => null),
            fetch(`https://learn.hoseo.ac.kr/mod/assign/index.php?id=${courseId}`).catch(() => null),
            fetch(`https://learn.hoseo.ac.kr/mod/quiz/index.php?id=${courseId}`).catch(() => null),
            fetch(`https://learn.hoseo.ac.kr/course/view.php?id=${courseId}`).catch(() => null)
        ]);

        // 로그인 세션 만료 감지
        if ([attendRes, assignRes, quizRes, viewRes].some(r => r?.url?.includes(LOGIN_PATTERN))) {
            return { items, assigns, activities, courseName: courseTitleStr, sessionExpired: true };
        }

        // ── 출석 파싱 ──
        if (attendRes?.ok) {
            try {
                const doc = new DOMParser().parseFromString(await attendRes.text(), 'text/html');
                courseTitleStr = doc.title.replace('학습관리시스템(LMS)', '').trim() || courseTitleStr;
                courseTitleStr = courseTitleStr.replace(/\s*\(\d+\)$/, '');

                const sectionLinks = doc.querySelectorAll('#modal-coursemos-sections .section-item a');
                for (let i = 0; i < sectionLinks.length; i++) {
                    const title = sectionLinks[i].getAttribute('title') || sectionLinks[i].innerText || '';
                    const m = title.match(/(\d+)주차\s*(\[[^\]]+\])/);
                    if (m) periodMap[m[1]] = m[2];
                }

                const table = doc.querySelector('.local-ubonattend table.table-coursemos');
                if (table) {
                    table.querySelectorAll('button').forEach(b => b.remove());
                    table.querySelectorAll('a').forEach(a => { a.target = '_blank'; a.removeAttribute('onclick'); });

                    let currentWeekNum = null, currentPeriod = null;
                    const rows = table.querySelectorAll('tbody tr');

                    for (let ri = 0; ri < rows.length; ri++) {
                        const tds = rows[ri].querySelectorAll(':scope > td');
                        const len = tds.length;
                        if (len === 0) continue;

                        let materialTd, reqTimeTd, readTimeTd, statusTd;
                        if (len === 7) {
                            currentWeekNum = parseInt(tds[0].innerText.trim(), 10);
                            currentPeriod = periodMap[currentWeekNum] || '';
                            materialTd = tds[1]; reqTimeTd = tds[2]; readTimeTd = tds[4]; statusTd = tds[5];
                        } else if (len === 5) {
                            materialTd = tds[0]; reqTimeTd = tds[1]; readTimeTd = tds[3]; statusTd = tds[4];
                        } else continue;

                        const materialHtml = sanitize(materialTd.innerHTML.replace(/&nbsp;/g, '').trim());
                        if (!materialHtml) continue;

                        const statusText = statusTd.innerText.trim().toUpperCase();
                        const isCompleted = statusText.includes('O') || statusText.includes('○') || statusText.includes('출석');
                        const statusInner = sanitize(statusTd.innerHTML);

                        items.push({
                            courseId, courseName: courseTitleStr, weekNum: currentWeekNum, periodStr: currentPeriod,
                            materialHtml, reqTimeHtml: sanitize(reqTimeTd.innerHTML),
                            readTimeHtml: sanitize(readTimeTd.innerHTML),
                            statusHtml: isCompleted ? `<span class="lms-status-ok">${statusInner}</span>` : statusInner,
                            isCompleted
                        });
                    }
                }
            } catch (e) { console.error('[LMS+] 출석 파싱 오류 (course ' + courseId + ')', e); }
        }

        // ── 과제 파싱 ──
        if (assignRes?.ok) {
            try {
                const assignDoc = new DOMParser().parseFromString(await assignRes.text(), 'text/html');
                const assignTable = assignDoc.querySelector('.generaltable') || assignDoc.querySelector('table.table') || assignDoc.querySelector('table');

                if (assignTable) {
                    let currentAssignWeekNum = null, currentAssignPeriod = null;
                    const assignRows = assignTable.querySelectorAll('tr');

                    for (let ri = 0; ri < assignRows.length; ri++) {
                        const row = assignRows[ri];
                        if (row.querySelector('th') && !row.querySelector('td')) continue;
                        const tds = row.querySelectorAll(':scope > td');
                        const tdsLen = tds.length;
                        if (tdsLen < 3) continue;

                        const td0Text = tds[0].textContent.replace(/\u00a0/g, ' ').trim();
                        const weekMatch = td0Text.match(/(\d+)\s*(주|회|Week)/i) || ((/^\d+$/).test(td0Text) ? td0Text.match(/(\d+)/) : null);
                        const isWeekCell = !!weekMatch;
                        const isContinuationRow = !td0Text && tdsLen >= 5;
                        const titleIndex = (isWeekCell || isContinuationRow) ? 1 : 0;

                        if (isWeekCell) {
                            currentAssignWeekNum = parseInt(weekMatch[1], 10);
                            const pMatch = td0Text.match(/(\[[^\]]+\])/);
                            currentAssignPeriod = pMatch ? pMatch[1] : (periodMap[currentAssignWeekNum] || '');
                        }
                        if (!currentAssignWeekNum) continue;

                        const titleTd = tds[titleIndex], dueTd = tds[titleIndex + 1];
                        const submitTd = tds[titleIndex + 2], gradeTd = tds[titleIndex + 3];
                        if (!titleTd || !titleTd.textContent.trim()) continue;

                        titleTd.querySelectorAll('a').forEach(a => a.target = '_blank');

                        const submitText = submitTd ? submitTd.textContent.replace(/\u00a0/g, ' ').trim() : '';
                        const isCompleted = submitText.includes('완료') || submitText.includes('제출됨') || submitText.includes('채점') || (submitText.includes('제출') && !submitText.includes('미제출'));
                        const submitInner = submitTd ? sanitize(submitTd.innerHTML) : '-';

                        assigns.push({
                            courseId, courseName: courseTitleStr, weekNum: currentAssignWeekNum, periodStr: currentAssignPeriod,
                            titleHtml: sanitize(titleTd.innerHTML),
                            dueDateHtml: dueTd ? sanitize(dueTd.innerHTML) : '-',
                            submitStatusHtml: isCompleted
                                ? `<span class="lms-status-ok">${submitInner}</span>`
                                : `<span class="lms-status-fail">${submitText ? submitInner : '미제출'}</span>`,
                            gradeHtml: gradeTd ? sanitize(gradeTd.innerHTML) : '-',
                            isCompleted
                        });
                    }
                }
            } catch (e) { console.error('[LMS+] 과제 파싱 오류 (course ' + courseId + ')', e); }
        }

        // ── 퀴즈 파싱 ──
        if (quizRes?.ok) {
            try {
                const quizDoc = new DOMParser().parseFromString(await quizRes.text(), 'text/html');
                const quizTable = quizDoc.querySelector('.generaltable') || quizDoc.querySelector('table.table') || quizDoc.querySelector('table');

                if (quizTable) {
                    const quizRows = quizTable.querySelectorAll('tbody tr');
                    for (let ri = 0; ri < quizRows.length; ri++) {
                        const tds = quizRows[ri].querySelectorAll(':scope > td');
                        if (tds.length < 4) continue;

                        const td0Text = tds[0].textContent.replace(/\u00a0/g, ' ').trim();
                        const weekMatch = td0Text.match(/(\d+)\s*(주|회|Week)/i);
                        if (!weekMatch) continue;

                        const currentQuizWeekNum = parseInt(weekMatch[1], 10);
                        const pMatch = td0Text.match(/(\[[^\]]+\])/);
                        const currentQuizPeriod = pMatch ? pMatch[1] : (periodMap[currentQuizWeekNum] || '');
                        const titleTd = tds[1];
                        const dueTd = tds[2];
                        const gradeTd = tds[tds.length - 1];

                        if (!titleTd || !titleTd.textContent.trim()) continue;

                        titleTd.querySelectorAll('a').forEach(a => a.target = '_blank');

                        const gradeText = gradeTd ? gradeTd.textContent.replace(/\u00a0/g, ' ').trim() : '';
                        const isCompleted = gradeText !== '' && gradeText !== '-';
                        const gradeInner = gradeTd ? sanitize(gradeTd.innerHTML) : '-';

                        assigns.push({
                            courseId, courseName: courseTitleStr, weekNum: currentQuizWeekNum, periodStr: currentQuizPeriod,
                            titleHtml: `<span style="color:#007bff;font-weight:bold;margin-right:4px">[퀴즈]</span>` + sanitize(titleTd.innerHTML),
                            dueDateHtml: dueTd ? sanitize(dueTd.innerHTML) : '-',
                            submitStatusHtml: isCompleted
                                ? `<span class="lms-status-ok">제출(응시)완료</span>`
                                : `<span class="lms-status-fail">미응시</span>`,
                            gradeHtml: isCompleted ? gradeInner : '-',
                            isCompleted
                        });
                    }
                }
            } catch (e) { console.error('[LMS+] 퀴즈 파싱 오류 (course ' + courseId + ')', e); }
        }

        // ── 강좌 메인 페이지 파싱 (전체 학습 자료/활동) ──
        if (viewRes?.ok) {
            try {
                const viewDoc = new DOMParser().parseFromString(await viewRes.text(), 'text/html');
                const listSections = viewDoc.querySelectorAll('ul.weeks > li.section.main');
                listSections.forEach(section => {
                    const titleEl = section.querySelector('h3.sectionname');
                    if (!titleEl) return;
                    const secTitle = titleEl.textContent.trim();
                    const weekMatch = secTitle.match(/(\d+)주차/);
                    if (!weekMatch) return;
                    const weekNum = parseInt(weekMatch[1], 10);
                    const pMatch = secTitle.match(/(\[[^\]]+\])/);
                    const periodStr = pMatch ? pMatch[1] : (periodMap[weekNum] || '');

                    section.querySelectorAll('li.activity').forEach(actEl => {
                        const iconEl = actEl.querySelector('.activityicon');
                        const type = iconEl ? iconEl.alt : '기타';

                        const aEl = actEl.querySelector('a.aalink');
                        if (!aEl) return;

                        aEl.querySelectorAll('.accesshide').forEach(h => h.remove());
                        const nameHtml = sanitize(aEl.innerHTML);
                        const href = aEl.getAttribute('href') || '#';

                        const displayOpts = actEl.querySelector('.displayoptions');
                        const optionsHtml = displayOpts ? sanitize(displayOpts.innerHTML) : '';

                        let statusHtml = '-';
                        let isCompleted = false;
                        const badgeContainer = actEl.querySelector('.badge-completion');
                        if (badgeContainer) {
                            const titleAttr = badgeContainer.getAttribute('title') || '';
                            if (titleAttr.includes('완료함')) {
                                statusHtml = `<span class="lms-status-ok">✔ 완료</span>`;
                                isCompleted = true;
                            } else if (titleAttr.includes('완료하지 못함') || titleAttr.includes('완료하지 않음')) {
                                statusHtml = `<span class="lms-status-fail">미완료</span>`;
                            }
                        }

                        let isMatchedVideo = false;
                        let extraInfoHtml = optionsHtml;
                        const cleanName = stripHtml(nameHtml);

                        if (isVideoType(type)) {
                            const matched = items.find(it => it.weekNum === weekNum && stripHtml(it.materialHtml).includes(cleanName));
                            if (matched) {
                                extraInfoHtml += `<br/><span class="lms-extra-info">(요구: ${stripBr(matched.reqTimeHtml)} / 누적: ${stripBr(matched.readTimeHtml)})</span>`;
                                statusHtml = matched.statusHtml;
                                isCompleted = matched.isCompleted;
                                isMatchedVideo = true;
                            }
                        } else if (isAssignType(type)) {
                            const matched = assigns.find(a => a.weekNum === weekNum && stripHtml(a.titleHtml).includes(cleanName.replace(/\[퀴즈\]\s*/, '')));
                            if (matched) {
                                extraInfoHtml += `<br/><span class="lms-extra-info">(성적: ${stripBr(matched.gradeHtml)})</span>`;
                                statusHtml = matched.submitStatusHtml;
                                isCompleted = matched.isCompleted;
                            }
                        }

                        // 확실한 이수 여부 확인이 가능한 항목 외에는 Neutral 처리
                        const isNeutral = !(isAssignType(type) || (isVideoType(type) && isMatchedVideo));
                        if (isNeutral) statusHtml = '-';

                        activities.push({
                            courseId, courseName: courseTitleStr, weekNum, periodStr, type,
                            nameHtml: `<a href="${href}" target="_blank" style="text-decoration:none;color:inherit;">${nameHtml}</a>`,
                            optionsHtml: extraInfoHtml, statusHtml, isCompleted, isNeutral
                        });
                    });
                });
            } catch (e) {
                console.error('[LMS+] view.php 파싱 오류 (course ' + courseId + ')', e);
            }
        }

        return { courseId, items, assigns, activities, courseName: courseTitleStr, sessionExpired: false };
    };

    // ── 통합 데이터 fetch (프로그레스 + 캐싱) ──
    const fetchAllCourseData = async (courseIds, onProgress) => {
        let loaded = 0, sessionExpired = false;
        const results = await Promise.all(courseIds.map(async (id) => {
            const result = await fetchCourseData(id);
            loaded++;
            if (result.sessionExpired) sessionExpired = true;
            if (onProgress) onProgress(loaded, courseIds.length);
            return result;
        }));

        const allCourseNamesMap = new Map();
        for (const r of results) {
            if (r.courseName) allCourseNamesMap.set(r.courseName, r.courseId);
        }
        const allCourseNames = Array.from(allCourseNamesMap.entries())
            .map(([courseName, courseId]) => ({ courseName, courseId }))
            .sort((a, b) => a.courseName.localeCompare(b.courseName));

        if (sessionExpired) return { allItems: [], allAssigns: [], allActivities: [], allCourseNames, sessionExpired: true };

        const allItems = [], allAssigns = [], allActivities = [];
        for (const r of results) {
            allItems.push(...r.items);
            allAssigns.push(...r.assigns);
            allActivities.push(...r.activities);
        }
        const data = { allItems, allAssigns, allActivities, allCourseNames, sessionExpired: false };
        setCachedData(data);
        return data;
    };

    // ── 공용 컬럼 렌더러 ──
    const COL_COURSE = (d, isNew, size) => isNew
        ? `<td rowspan="${size}" class="lms-td-course"><a href="/course/view.php?id=${d.courseId}" target="_blank" style="text-decoration:none;font-weight:bold;color:#0056b3;">${d.courseName}</a></td>`
        : '';
    const COL_TYPE = (d) => `<td>${d.type}</td>`;
    const COL_NAME = (d) => `<td class="lms-td-left">${d.nameHtml}</td>`;
    const COL_OPTIONS = (d) => `<td><div class="lms-td-options">${d.optionsHtml}</div></td>`;
    const COL_STATUS = (d) => `<td>${d.statusHtml}</td>`;

    // ── 렌더링 헬퍼 (통합) ──
    const buildTableRows = (dataArr, columns, getGroupKey, bgFn) => {
        if (!bgFn) bgFn = (d) => d.isNeutral ? '#ffffff' : (d.isCompleted ? 'var(--lms-row-success)' : 'var(--lms-row-danger)');

        const groupSizes = new Map();
        for (const d of dataArr) {
            const gk = getGroupKey(d);
            groupSizes.set(gk, (groupSizes.get(gk) || 0) + 1);
        }

        const parts = [];
        let prevGroup = '';
        for (const d of dataArr) {
            const gk = getGroupKey(d);
            const isNew = gk !== prevGroup;
            prevGroup = gk;
            const gSize = groupSizes.get(gk);
            parts.push(`<tr style="border-bottom:1px solid var(--lms-border-light);border-top:${isNew ? '2px solid var(--lms-border)' : '1px solid var(--lms-border-light)'};background-color:${bgFn(d)}">`);
            for (const col of columns) parts.push(col(d, isNew, gSize));
            parts.push('</tr>');
        }
        return parts.join('');
    };

    // ── 섹션별 렌더 함수 ──
    const renderHeader = () => `
        <div class="lms-card lms-header">
            <h3 class="lms-title">호서 LMS+ 대시보드</h3>
            <div style="display:flex;gap:8px;align-items:center">
                <button id="lms-refresh-btn" class="btn btn-default btn-outline-secondary lms-btn">🔄 새로고침</button>
                <button id="lms-home-btn" class="btn btn-default btn-outline-secondary lms-btn">LMS 홈으로 복귀</button>
            </div>
        </div>`;

    const renderCourseList = (courseNames) => {
        if (courseNames.length === 0) return '';
        const chips = courseNames.map(c => `<a href="/course/view.php?id=${c.courseId}" target="_blank" class="lms-course-chip" style="text-decoration:none;color:inherit;">${c.courseName}</a>`).join('');
        return `
            <div class="lms-card lms-course-list">
                <span class="lms-course-list-label">📚 불러온 강좌 (${courseNames.length})</span>
                <div class="lms-course-chips">${chips}</div>
            </div>`;
    };

    const renderWeekNav = (week, periodStr, canPrev, canNext) => `
        <div class="lms-card" style="padding:30px;margin-bottom:30px;text-align:left">
        <div class="lms-week-nav">
            <button id="dash-prev-btn" class="lms-nav-btn ${canPrev ? '' : 'disabled'}">&lt;</button>
            <div style="text-align:center;width:250px">
                <h3 class="lms-week-title">${week}주차</h3>
                <div class="lms-period-badge">${periodStr}</div>
            </div>
            <button id="dash-next-btn" class="lms-nav-btn ${canNext ? '' : 'disabled'}">&gt;</button>
        </div>`;

    const ACTIVITY_TH = `<th style="width:20%" class="lms-th-center">과목명</th><th style="width:10%">유형</th><th style="width:35%" class="lms-th-left">자료 / 활동명</th><th style="width:25%">기간 / 상세 정보</th><th style="width:10%">이수 여부</th>`;
    const ACTIVITY_COLS = [COL_COURSE, COL_TYPE, COL_NAME, COL_OPTIONS, COL_STATUS];

    const renderTable = (dataArr, title, icon, thCols, tdCols, bgFn) => {
        if (dataArr.length === 0) return '';
        const sorted = dataArr.slice().sort((a, b) => a.courseName.localeCompare(b.courseName));
        const rows = buildTableRows(sorted, tdCols, d => d.courseId, bgFn);
        return `
            <div style="overflow-x:auto;margin-bottom:30px">
                <h4 class="lms-section-title"><span class="lms-section-icon">${icon}</span> ${title}</h4>
                <table class="table table-bordered table-hover lms-table">
                    <thead><tr class="lms-thead-row">${thCols}</tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
    };

    const renderIncompleteSection = (incActivities) => {
        const parts = ['<div class="lms-card" style="padding:30px;margin-bottom:50px;text-align:left">'];

        if (incActivities.length > 0) {
            parts.push(`<div class="lms-incomplete-header">
                <h4 class="lms-incomplete-title"><span style="font-size:20px;margin-right:8px">🚨</span> 미수강 및 미제출 항목 (전체 주차 통합)</h4>
            </div>`);

            const incCols = [
                COL_COURSE,
                (d) => `<td class="lms-td-week">${d.weekNum}주차</td>`,
                COL_TYPE, COL_NAME, COL_OPTIONS, COL_STATUS
            ];

            const rows = buildTableRows(incActivities, incCols, d => d.courseId, () => '#fffcfc');

            parts.push(`<div style="overflow-x:auto;margin-bottom:10px">
                <table class="table table-bordered table-hover lms-table">
                    <thead><tr class="lms-thead-danger">
                        <th style="width:20%" class="lms-th-center">과목명</th><th style="width:10%">해당 주차</th>
                        <th style="width:10%">유형</th><th style="width:30%" class="lms-th-left">자료 / 활동명</th>
                        <th style="width:20%">기간 / 상세 정보</th><th style="width:10%">이수 여부</th>
                    </tr></thead><tbody>${rows}</tbody>
                </table></div>`);
        } else {
            parts.push(`<div style="text-align:center;padding:40px 20px">
                <h3 class="lms-all-complete">🎉 모든 주차의 수강을 완료하고 과제를 제출했습니다!</h3>
            </div>`);
        }
        parts.push('</div>');
        return parts.join('');
    };

    // ── 메인 로직 ──
    const replacePageContent = () => {
        const pageContent = document.querySelector('#region-main') || document.querySelector('#page-content') || document.querySelector('main') || document.body;
        if (document.getElementById('lms-custom-dashboard')) return;
        document.title = '호서 LMS+ 대시보드';
        if (!savedCourseIds) savedCourseIds = getCourseIds();
        const courseIds = savedCourseIds;
        pageContent.innerHTML = `
            <div id="lms-custom-dashboard" class="lms-dashboard">
                <div class="lms-card lms-loading">
                    <h3 class="lms-loading-title">출석 정보를 불러오고 있습니다...</h3>
                    <div class="lms-progress-container"><div class="lms-progress-bar" id="lms-progress-bar"></div></div>
                    <p class="lms-loading-sub" id="lms-loading-text">잠시만 기다려주세요.</p>
                </div>
            </div>`;
        fetchAndRender(courseIds);
    };

    const fetchAndRender = async (courseIds) => {
        const lc = document.getElementById('lms-custom-dashboard');
        if (!lc || courseIds.length === 0) {
            if (lc) lc.innerHTML = '<p>강좌를 찾을 수 없습니다.</p>';
            return;
        }

        let data = getCachedData();
        if (!data) {
            data = await fetchAllCourseData(courseIds, (loaded, total) => {
                const bar = document.getElementById('lms-progress-bar');
                const txt = document.getElementById('lms-loading-text');
                if (bar) bar.style.width = `${(loaded / total) * 100}%`;
                if (txt) txt.textContent = `${loaded}/${total} 강좌 로딩 중...`;
            });
        }

        if (data.sessionExpired) {
            lc.innerHTML = `<div class="lms-card" style="text-align:center;padding:40px">
                <h3 style="color:var(--lms-danger);margin-bottom:15px">⚠️ 로그인 세션이 만료되었습니다.</h3>
                <p style="color:var(--lms-text-light);margin-bottom:20px">페이지를 새로고침하고 다시 로그인해주세요.</p>
                <button onclick="window.location.reload()" class="btn btn-primary" style="font-size:15px;padding:8px 20px">새로고침</button>
            </div>`;
            return;
        }

        const { allItems, allAssigns, allActivities = [] } = data;
        if (allItems.length === 0 && allAssigns.length === 0 && allActivities.length === 0) {
            lc.innerHTML = `<div class="lms-card" style="text-align:center;padding:40px">
                <h3 style="color:var(--lms-danger);margin-bottom:20px">출석 및 과제 정보를 불러올 수 없거나 항목이 없습니다.</h3>
                <button id="lms-home-btn" class="btn btn-primary" style="font-size:15px;padding:8px 20px">LMS 홈으로 복귀</button>
            </div>`;
            document.getElementById('lms-home-btn')?.addEventListener('click', () => { window.location.href = '/'; });
            return;
        }

        // 주차별 그룹화
        const itemsByWeek = groupByWeek(allItems);
        const assignsByWeek = groupByWeek(allAssigns);
        const activitiesByWeek = groupByWeek(allActivities);

        const weekSet = new Set([...itemsByWeek.keys(), ...assignsByWeek.keys(), ...activitiesByWeek.keys()]);
        const sortedWeeks = Array.from(weekSet).sort((a, b) => a - b);

        if (sortedWeeks.length === 0) {
            lc.innerHTML = '<div class="lms-card" style="text-align:center;padding:40px"><h3 style="color:#888">표시할 주차가 없습니다.</h3></div>';
            return;
        }

        const incActivities = dedupActivities(
            allActivities.filter(x => !x.isCompleted && !x.isNeutral)
                .sort((a, b) => a.courseName.localeCompare(b.courseName) || a.weekNum - b.weekNum)
        );

        let weekIdx = findCurrentWeekIndex(sortedWeeks, itemsByWeek, assignsByWeek, activitiesByWeek);
        const courseNames = data.allCourseNames || [];

        const renderCurrentWeek = () => {
            const week = sortedWeeks[weekIdx];
            const activities = dedupActivities(activitiesByWeek.get(week) || []);
            const periodStr = (itemsByWeek.get(week)?.[0] || assignsByWeek.get(week)?.[0] || activities[0])?.periodStr || '';
            const canPrev = weekIdx > 0, canNext = weekIdx < sortedWeeks.length - 1;

            lc.innerHTML = [
                renderHeader(),
                renderCourseList(courseNames),
                renderWeekNav(week, periodStr, canPrev, canNext),
                renderTable(activities, '전체 학습 자료 및 활동 (통합본)', '📁', ACTIVITY_TH, ACTIVITY_COLS),
                '</div>',
                renderIncompleteSection(incActivities)
            ].join('');
            lc.style.textAlign = 'center';

            // 이벤트 바인딩
            document.getElementById('lms-home-btn')?.addEventListener('click', () => { window.location.href = '/'; });
            document.getElementById('lms-refresh-btn')?.addEventListener('click', () => {
                sessionStorage.removeItem(CACHE_KEY);
                document.getElementById('lms-custom-dashboard')?.remove();
                replacePageContent();
            });
            document.getElementById('dash-prev-btn')?.addEventListener('click', () => {
                if (weekIdx > 0) { weekIdx--; renderCurrentWeek(); }
            });
            document.getElementById('dash-next-btn')?.addEventListener('click', () => {
                if (weekIdx < sortedWeeks.length - 1) { weekIdx++; renderCurrentWeek(); }
            });

            // 키보드 네비게이션 (중복 방지)
            if (window._lmsKeyHandler) document.removeEventListener('keydown', window._lmsKeyHandler);
            window._lmsKeyHandler = (e) => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                if (!document.getElementById('lms-custom-dashboard')) {
                    document.removeEventListener('keydown', window._lmsKeyHandler);
                    return;
                }
                if (e.key === 'ArrowLeft' && weekIdx > 0) { weekIdx--; renderCurrentWeek(); }
                else if (e.key === 'ArrowRight' && weekIdx < sortedWeeks.length - 1) { weekIdx++; renderCurrentWeek(); }
            };
            document.addEventListener('keydown', window._lmsKeyHandler);
        };

        renderCurrentWeek();
    };

    /** 현재 날짜 기반 주차 인덱스 */
    const findCurrentWeekIndex = (sortedWeeks, itemsByWeek, assignsByWeek, activitiesByWeek) => {
        const today = new Date(), yr = today.getFullYear();
        for (let i = 0; i < sortedWeeks.length; i++) {
            const w = sortedWeeks[i];
            const ps = (itemsByWeek.get(w)?.[0] || assignsByWeek.get(w)?.[0] || activitiesByWeek.get(w)?.[0])?.periodStr;
            if (!ps) continue;
            const dm = ps.match(/\[?\s*(\d+)[^\d]+(\d+)[^\d]+(\d+)[^\d]+(\d+)/);
            if (!dm) continue;
            const s = new Date(yr, dm[1] - 1, dm[2], 0, 0, 0);
            const e = new Date(yr, dm[3] - 1, dm[4], 23, 59, 59);
            if (dm[3] - 1 < dm[1] - 1) { e.setFullYear(yr + 1); if (today.getMonth() < dm[1] - 1) s.setFullYear(yr + 1); }
            if (today >= s && today <= e) return i;
        }
        return 0;
    };

    // ── 사이드바 탭 추가 ──
    let tabRetries = 0;
    const addCalendarTab = () => {
        const ul = document.querySelector('#mCSB_1_container > ul');
        if (ul && !document.getElementById('lms-calendar-tab')) {
            const li = document.createElement('li');
            li.id = 'lms-calendar-tab';
            li.className = 'menu-item';
            const a = document.createElement('a');
            a.href = '#';
            a.className = 'site-menu-link nosubmenu ';
            a.title = '호서 LMS+ 대시보드';
            a.style.cursor = 'pointer';
            a.innerHTML = `<i class="fa site-menu-icon fa-th-list" aria-hidden="true"></i><div class="text-truncate">호서 LMS+</div>`;
            li.appendChild(a);
            ul.appendChild(li);
            a.addEventListener('click', (e) => { e.preventDefault(); replacePageContent(); });
            console.log('[LMS+] Dashboard tab injected.');
            observer.disconnect();
        } else if (!document.getElementById('lms-calendar-tab') && tabRetries < MAX_TAB_RETRIES) {
            tabRetries++;
            setTimeout(addCalendarTab, 1000);
        }
    };

    // ── 백그라운드 프리캐싱 ──
    const preCacheData = () => {
        if (getCachedData()) return;
        if (!savedCourseIds) savedCourseIds = getCourseIds();
        if (savedCourseIds.length === 0) return;
        console.log('[LMS+] Pre-caching course data...');
        fetchAllCourseData(savedCourseIds, null)
            .then(() => console.log('[LMS+] Pre-cache complete.'))
            .catch(e => console.error('[LMS+] Pre-cache failed:', e));
    };

    // ── 초기화 ──
    addCalendarTab();

    const observer = new MutationObserver(() => {
        if (!document.getElementById('lms-calendar-tab') && document.querySelector('#mCSB_1_container > ul')) {
            addCalendarTab();
        }
    });
    const sidebar = document.querySelector('#mCSB_1_container') || document.body;
    observer.observe(sidebar, { childList: true, subtree: true });

    // 페이지 로드 후 3초 뒤 백그라운드 프리캐싱
    setTimeout(preCacheData, 3000);
})();
