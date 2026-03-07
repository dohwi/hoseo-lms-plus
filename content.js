// ===== 호서 LMS+ 대시보드 ======
// 메인 페이지(/ 또는 /index.php)에서만 동작

(() => {
    'use strict';

    const path = window.location.pathname;
    if (path !== '/' && path !== '/index.php') return;

    // ── 상수 ──
    const CACHE_KEY = 'lms_plus_cache';
    const CACHE_TTL = 5 * 60 * 1000; // 5분
    const MAX_TAB_RETRIES = 10;
    const LOGIN_PATTERN = '/login/';
    let savedCourseIds = null;

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

    // ── 유틸리티 ──
    const getCourseIds = () => {
        const els = document.querySelectorAll('.lists .course');
        const ids = [];
        for (let i = 0; i < els.length; i++) {
            const id = els[i].getAttribute('data-id');
            if (id) ids.push(id);
        }
        return ids;
    };

    /** XSS 방어: script 태그 제거 */
    const sanitize = (html) => html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    const joinHtml = (parts) => parts.join('');

    // ── 데이터 Fetch ──
    const fetchCourseData = async (courseId) => {
        const items = [];
        const assigns = [];
        let courseTitleStr = `강좌 ${courseId}`;
        let periodMap = {};

        const [attendRes, assignRes] = await Promise.all([
            fetch(`https://learn.hoseo.ac.kr/local/ubonattend/my_status.php?id=${courseId}`).catch(() => null),
            fetch(`https://learn.hoseo.ac.kr/mod/assign/index.php?id=${courseId}`).catch(() => null)
        ]);

        // 로그인 세션 만료 감지
        if (attendRes?.url?.includes(LOGIN_PATTERN) || assignRes?.url?.includes(LOGIN_PATTERN)) {
            return { items, assigns, courseName: courseTitleStr, sessionExpired: true };
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
                            courseName: courseTitleStr, weekNum: currentWeekNum, periodStr: currentPeriod,
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
                            courseName: courseTitleStr, weekNum: currentAssignWeekNum, periodStr: currentAssignPeriod,
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

        return { items, assigns, courseName: courseTitleStr, sessionExpired: false };
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

        // 조회한 모든 강좌명 수집
        const allCourseNames = results.map(r => r.courseName).filter(Boolean);
        allCourseNames.sort((a, b) => a.localeCompare(b));

        if (sessionExpired) return { allItems: [], allAssigns: [], allCourseNames, sessionExpired: true };

        const allItems = [], allAssigns = [];
        for (const r of results) {
            allItems.push(...r.items);
            allAssigns.push(...r.assigns);
        }
        const data = { allItems, allAssigns, allCourseNames, sessionExpired: false };
        setCachedData(data);
        return data;
    };

    // ── 렌더링 헬퍼 (통합) ──
    const buildTableRows = (dataArr, columns, getGroupKey, opts = {}) => {
        const {
            borderNew = '2px solid var(--lms-border)',
            borderNorm = '1px solid var(--lms-border-light)',
            bgFn = (d) => d.isCompleted ? 'var(--lms-row-success)' : 'var(--lms-row-danger)'
        } = opts;

        const parts = [];
        let prevGroup = '';
        for (const d of dataArr) {
            const gk = getGroupKey(d);
            const isNew = gk !== prevGroup;
            prevGroup = gk;
            parts.push(`<tr style="border-bottom:1px solid var(--lms-border-light);border-top:${isNew ? borderNew : borderNorm};background-color:${bgFn(d)}">`);
            for (const col of columns) parts.push(col(d, isNew));
            parts.push('</tr>');
        }
        return joinHtml(parts);
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
        const chips = courseNames.map(name => `<span class="lms-course-chip">${name}</span>`).join('');
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

    const renderTable = (dataArr, title, icon, thCols, tdCols) => {
        if (dataArr.length === 0) return '';
        const sorted = dataArr.slice().sort((a, b) => a.courseName.localeCompare(b.courseName));
        const rows = buildTableRows(sorted, tdCols, d => d.courseName);
        return `
            <div style="overflow-x:auto;margin-bottom:30px">
                <h4 class="lms-section-title"><span class="lms-section-icon">${icon}</span> ${title}</h4>
                <table class="table table-bordered table-hover lms-table">
                    <thead><tr class="lms-thead-row">${thCols}</tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
    };

    const renderIncompleteSection = (incItems, incAssigns) => {
        const parts = ['<div class="lms-card" style="padding:30px;margin-bottom:50px;text-align:left">'];
        const dangerOpts = {
            borderNew: '2px solid var(--lms-danger-border)',
            borderNorm: '1px solid var(--lms-danger-light)',
            bgFn: () => '#fffcfc'
        };

        if (incItems.length > 0 || incAssigns.length > 0) {
            parts.push(`<div class="lms-incomplete-header">
                <h4 class="lms-incomplete-title"><span style="font-size:20px;margin-right:8px">🚨</span> 미수강 및 미제출 항목 (전체 주차)</h4>
            </div>`);

            if (incItems.length > 0) {
                const rows = buildTableRows(incItems, [
                    (d) => `<td class="lms-td-week">${d.weekNum}주차</td>`,
                    (d, n) => `<td class="lms-td-course">${n ? d.courseName : ''}</td>`,
                    (d) => `<td class="lms-td-left">${d.materialHtml}</td>`,
                    (d) => `<td>${d.reqTimeHtml}</td>`,
                    (d) => `<td>${d.readTimeHtml}</td>`
                ], d => d.courseName, dangerOpts);
                parts.push(`<div style="overflow-x:auto;margin-bottom:25px">
                    <h5 class="lms-incomplete-sub-title"><span style="margin-right:5px">▶</span> 온라인 출석</h5>
                    <table class="table table-bordered table-hover lms-table">
                        <thead><tr class="lms-thead-danger">
                            <th style="width:15%">해당 주차</th><th style="width:25%" class="lms-th-left">과목명</th>
                            <th style="width:35%" class="lms-th-left">강의 자료</th><th style="width:10%">요구 시간</th><th style="width:15%">누적 열람 시간</th>
                        </tr></thead><tbody>${rows}</tbody>
                    </table></div>`);
            }

            if (incAssigns.length > 0) {
                const rows = buildTableRows(incAssigns, [
                    (d) => `<td class="lms-td-week">${d.weekNum}주차</td>`,
                    (d, n) => `<td class="lms-td-course">${n ? d.courseName : ''}</td>`,
                    (d) => `<td class="lms-td-left">${d.titleHtml}</td>`,
                    (d) => `<td>${d.dueDateHtml}</td>`,
                    (d) => `<td>${d.submitStatusHtml}</td>`
                ], d => d.courseName, dangerOpts);
                parts.push(`<div style="overflow-x:auto;margin-bottom:10px">
                    <h5 class="lms-incomplete-sub-title"><span style="margin-right:5px">▶</span> 과제 제출</h5>
                    <table class="table table-bordered table-hover lms-table">
                        <thead><tr class="lms-thead-danger">
                            <th style="width:15%">해당 주차</th><th style="width:25%" class="lms-th-left">과목명</th>
                            <th style="width:35%" class="lms-th-left">과제</th><th style="width:15%">종료 일시</th><th style="width:10%">제출물</th>
                        </tr></thead><tbody>${rows}</tbody>
                    </table></div>`);
            }
        } else {
            parts.push(`<div style="text-align:center;padding:40px 20px">
                <h3 class="lms-all-complete">🎉 모든 주차의 수강을 완료하고 과제를 제출했습니다!</h3>
            </div>`);
        }
        parts.push('</div>');
        return joinHtml(parts);
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

        const { allItems, allAssigns } = data;
        if (allItems.length === 0 && allAssigns.length === 0) {
            lc.innerHTML = `<div class="lms-card" style="text-align:center;padding:40px">
                <h3 style="color:var(--lms-danger);margin-bottom:20px">출석 및 과제 정보를 불러올 수 없거나 항목이 없습니다.</h3>
                <button id="lms-home-btn" class="btn btn-primary" style="font-size:15px;padding:8px 20px">LMS 홈으로 복귀</button>
            </div>`;
            document.getElementById('lms-home-btn')?.addEventListener('click', () => { window.location.href = '/'; });
            return;
        }

        // 주차별 그룹화
        const itemsByWeek = new Map(), assignsByWeek = new Map();
        for (const it of allItems) { if (!itemsByWeek.has(it.weekNum)) itemsByWeek.set(it.weekNum, []); itemsByWeek.get(it.weekNum).push(it); }
        for (const a of allAssigns) { if (!assignsByWeek.has(a.weekNum)) assignsByWeek.set(a.weekNum, []); assignsByWeek.get(a.weekNum).push(a); }

        const weekSet = new Set([...itemsByWeek.keys(), ...assignsByWeek.keys()]);
        const sortedWeeks = Array.from(weekSet).sort((a, b) => a - b);

        if (sortedWeeks.length === 0) {
            lc.innerHTML = '<div class="lms-card" style="text-align:center;padding:40px"><h3 style="color:#888">표시할 주차가 없습니다.</h3></div>';
            return;
        }

        const incItems = allItems.filter(x => !x.isCompleted).sort((a, b) => a.courseName.localeCompare(b.courseName));
        const incAssigns = allAssigns.filter(x => !x.isCompleted).sort((a, b) => a.courseName.localeCompare(b.courseName));
        let weekIdx = findCurrentWeekIndex(sortedWeeks, itemsByWeek, assignsByWeek);

        // 조회한 전체 강좌명 (fetchAllCourseData에서 수집됨)
        const courseNames = data.allCourseNames || [];

        const renderCurrentWeek = () => {
            const week = sortedWeeks[weekIdx];
            const items = itemsByWeek.get(week) || [];
            const assigns = assignsByWeek.get(week) || [];
            let periodStr = items[0]?.periodStr || assigns[0]?.periodStr || '';
            const canPrev = weekIdx > 0, canNext = weekIdx < sortedWeeks.length - 1;

            const parts = [
                renderHeader(),
                renderCourseList(courseNames),
                renderWeekNav(week, periodStr, canPrev, canNext),
                renderTable(items, '온라인 출석 현황', '▶',
                    `<th style="width:25%" class="lms-th-left">과목명</th><th style="width:40%" class="lms-th-left">강의 자료</th><th style="width:12%">요구 시간</th><th style="width:13%">누적 열람 시간</th><th style="width:10%">출결</th>`,
                    [(d, n) => `<td class="lms-td-course">${n ? d.courseName : ''}</td>`,
                    (d) => `<td class="lms-td-left">${d.materialHtml}</td>`,
                    (d) => `<td>${d.reqTimeHtml}</td>`,
                    (d) => `<td>${d.readTimeHtml}</td>`,
                    (d) => `<td>${d.statusHtml}</td>`]),
                renderTable(assigns, '과제 제출 현황', '▶',
                    `<th style="width:25%" class="lms-th-left">과목명</th><th style="width:35%" class="lms-th-left">과제</th><th style="width:15%">종료 일시</th><th style="width:15%">제출물</th><th style="width:10%">성적</th>`,
                    [(d, n) => `<td class="lms-td-course">${n ? d.courseName : ''}</td>`,
                    (d) => `<td class="lms-td-left">${d.titleHtml}</td>`,
                    (d) => `<td>${d.dueDateHtml}</td>`,
                    (d) => `<td>${d.submitStatusHtml}</td>`,
                    (d) => `<td>${d.gradeHtml}</td>`]),
                '</div>',
                renderIncompleteSection(incItems, incAssigns)
            ];

            lc.innerHTML = joinHtml(parts);
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
    const findCurrentWeekIndex = (sortedWeeks, itemsByWeek, assignsByWeek) => {
        const today = new Date(), yr = today.getFullYear();
        for (let i = 0; i < sortedWeeks.length; i++) {
            const w = sortedWeeks[i];
            const ps = (itemsByWeek.get(w)?.[0] || assignsByWeek.get(w)?.[0])?.periodStr;
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
