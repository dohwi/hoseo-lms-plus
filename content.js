// 메인 페이지의 강좌 목록(lists)에서 data-id를 배열로 추출하는 함수
const getCourseIds = () => {
    const courseElements = document.querySelectorAll('.lists .course');
    return Array.from(courseElements)
        .map(el => el.getAttribute('data-id'))
        .filter(id => id); // null 또는 빈 문자열 제외
};

const replacePageContent = () => {
    // 호서 LMS 내 다양한 페이지(메인, 강의실 등)의 본문 영역 셀렉터 후보
    const selectors = [
        '#region-main',
        '#page-content',
        '#ub-content',
        '.ub-content',
        '.main-container',
        '#content',
        '.course-content',
        'main'
    ];

    let pageContent = null;
    for (const selector of selectors) {
        pageContent = document.querySelector(selector);
        if (pageContent) {
            console.log(`[hoseo-lms-plus] Found content container: ${selector}`);
            break;
        }
    }

    if (!pageContent) {
        console.error('[hoseo-lms-plus] Could not find the main content container to replace.');
        pageContent = document.body;
    }

    if (pageContent && !document.getElementById('lms-custom-dashboard')) {
        document.title = "호서 LMS+ 대시보드";

        const courseIds = getCourseIds();

        pageContent.innerHTML = `
            <div id="lms-custom-dashboard" style="padding: 20px; background: transparent; margin-bottom: 20px; font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;">
                <div style="text-align: center; padding: 100px 0; background: white; border-radius: 12px; box-shadow: 0 4px 8px rgba(0,0,0,0.05);">
                    <h3 style="color: #1a5e9a; font-weight: bold; margin-bottom: 15px;">출석 정보를 불러오고 있습니다...</h3>
                    <p style="color: #777;">잠시만 기다려주세요.</p>
                </div>
            </div>
        `;

        fetchAttendanceLists(courseIds);
    }
};

const fetchAttendanceLists = async (courseIds) => {
    const listContainer = document.getElementById('lms-custom-dashboard');
    if (!listContainer || courseIds.length === 0) {
        if (listContainer) listContainer.innerHTML = '<p>강좌를 찾을 수 없습니다.</p>';
        return;
    }

    let allItems = [];
    let allAssigns = [];

    const fetchPromises = courseIds.map(async (courseId) => {
        let courseTitleStr = `강좌 ${courseId}`;
        let periodMap = {};

        try {
            const response = await fetch(`https://learn.hoseo.ac.kr/local/ubonattend/my_status.php?id=${courseId}`);
            if (!response.ok) return;

            const text = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');

            courseTitleStr = doc.title.replace('학습관리시스템(LMS)', '').trim() || courseTitleStr;
            // 과목명 뒤의 (05) 등의 분반 정보 제거
            courseTitleStr = courseTitleStr.replace(/\s*\(\d+\)$/, '');

            const sectionLinks = doc.querySelectorAll('#modal-coursemos-sections .section-item a');
            sectionLinks.forEach(a => {
                const title = a.getAttribute('title') || a.innerText || '';
                const match = title.match(/(\d+)주차\s*(\[[^\]]+\])/);
                if (match) {
                    periodMap[match[1]] = match[2];
                }
            });

            const table = doc.querySelector('.local-ubonattend table.table-coursemos');

            if (table) {
                const buttons = table.querySelectorAll('button');
                buttons.forEach(b => b.remove());

                const links = table.querySelectorAll('a');
                links.forEach(a => {
                    a.target = '_blank';
                    a.removeAttribute('onclick');
                });

                const rows = table.querySelectorAll('tbody tr');
                let currentWeekNum = null;
                let currentPeriod = null;

                rows.forEach(row => {
                    const tds = row.querySelectorAll('td');
                    if (tds.length === 0) return;

                    let materialTd, reqTimeTd, readTimeTd, statusTd;

                    // 병합된 셀(`rowspan`)이 있는 경우와 없는 경우를 고려
                    if (tds.length === 7) {
                        currentWeekNum = parseInt(tds[0].innerText.trim(), 10);
                        currentPeriod = periodMap[currentWeekNum] || '';
                        materialTd = tds[1];
                        reqTimeTd = tds[2];
                        readTimeTd = tds[4];
                        statusTd = tds[5];
                    } else if (tds.length === 5) {
                        materialTd = tds[0];
                        reqTimeTd = tds[1];
                        readTimeTd = tds[3];
                        statusTd = tds[4];
                    } else {
                        return;
                    }

                    const materialHtml = materialTd.innerHTML.replace(/&nbsp;/g, '').trim();
                    if (!materialHtml) return; // 비어있는 주차는 제외

                    const statusText = statusTd.innerText.trim().toUpperCase();
                    // O표시, 동그라미 기호, 또는 '출석' 텍스트 등을 완료 상태로 간주
                    const isCompleted = statusText.includes('O') || statusText.includes('○') || statusText.includes('출석');

                    // 완료되면 초록색 배경(f6fdf8), 아니면 빨간색 배경(fff8f8)
                    const rowBgColor = isCompleted ? '#f6fdf8' : '#fff8f8';

                    // 텍스트 색상도 구분을 원할 경우, O가 포함되어 있다면 초록색(색상: #28a745)으로 감싸줍니다. 원래 요소(HTML)는 최대한 보존합니다.
                    let finalStatusHtml = statusTd.innerHTML;
                    if (isCompleted) {
                        finalStatusHtml = `<span style="color: #28a745; font-weight: bold;">${finalStatusHtml}</span>`;
                    }

                    allItems.push({
                        courseName: courseTitleStr,
                        weekNum: currentWeekNum,
                        periodStr: currentPeriod,
                        materialHtml: materialHtml,
                        reqTimeHtml: reqTimeTd.innerHTML,
                        readTimeHtml: readTimeTd.innerHTML,
                        statusHtml: finalStatusHtml,
                        rowBg: rowBgColor,
                        isCompleted: isCompleted
                    });
                });
            }
        } catch (e) {
            console.error('Error fetching attendance for course ' + courseId, e);
        }

        // 과제 정보 가져오기 (매우 유연한 방식으로 테이블 파싱)
        try {
            const assignRes = await fetch(`https://learn.hoseo.ac.kr/mod/assign/index.php?id=${courseId}`);
            if (assignRes.ok) {
                const assignText = await assignRes.text();
                const assignParser = new DOMParser();
                const assignDoc = assignParser.parseFromString(assignText, 'text/html');

                // Moodle의 기본 테이블이 .generaltable 이지만, 디자인상 table.table 일 수도 있으므로 넓게 찾습니다.
                const assignTable = assignDoc.querySelector('.generaltable') || assignDoc.querySelector('table.table') || assignDoc.querySelector('table');

                if (assignTable) {
                    const assignRows = assignTable.querySelectorAll('tr');
                    let currentAssignWeekNum = null;
                    let currentAssignPeriod = null;

                    assignRows.forEach(row => {
                        // th 가 포함된 행은 테이블 헤더이므로 건너뜁니다
                        if (row.querySelector('th') && !row.querySelector('td')) return;

                        const tds = Array.from(row.querySelectorAll('td'));
                        if (tds.length < 3) return; // 유효한 데이터 행이 아님

                        let titleIndex = 1;
                        let td0Text = tds[0].textContent.replace(/\u00a0/g, ' ').trim();

                        // 첫 번째 칸(td0)에 주차 명칭(예: 1주차, Week 1, 1 등) 요소가 있는지 검사하여 병합 열(rowspan) 판별
                        if (tds.length >= 5 && /\d/.test(td0Text)) {
                            titleIndex = 1;
                        } else if (tds.length === 4 || !/\d/.test(td0Text)) {
                            titleIndex = 0; // 주차 셀이 병합되어 이미 생략된 상태
                        }

                        if (titleIndex === 1) {
                            const weekMatch = td0Text.match(/(\d+)\s*(주|회|Week)/i) || td0Text.match(/^(\d+)$/);
                            if (weekMatch) {
                                currentAssignWeekNum = parseInt(weekMatch[1], 10);
                                const pMatch = td0Text.match(/(\[[^\]]+\])/);
                                currentAssignPeriod = pMatch ? pMatch[1] : (periodMap[currentAssignWeekNum] || '');
                            }
                        }

                        if (!currentAssignWeekNum) return; // 어떤 주차의 과제인지 식별 불가하면 무시

                        const titleTd = tds[titleIndex];
                        const dueTd = tds[titleIndex + 1];
                        const submitTd = tds[titleIndex + 2];
                        const gradeTd = tds[titleIndex + 3];

                        if (!titleTd || !titleTd.textContent.trim()) return;

                        // a 태그가 있다면 새 창에서 열리도록 타겟 설정
                        const links = titleTd.querySelectorAll('a');
                        links.forEach(a => { a.target = '_blank'; });

                        const submitText = submitTd ? submitTd.textContent.replace(/\u00a0/g, ' ').trim() : '';

                        // 완료, 채점, 제출됨, 제출 완료 등의 텍스트가 있으면 성공 처리
                        const isCompleted = submitText.includes('완료') || submitText.includes('제출됨') || submitText.includes('채점') || (submitText.includes('제출') && !submitText.includes('미제출'));
                        const rowBgColor = isCompleted ? '#f6fdf8' : '#fff8f8';

                        let finalSubmitHtml = submitTd ? submitTd.innerHTML : '-';
                        if (isCompleted) {
                            finalSubmitHtml = `<span style="color: #28a745; font-weight: bold;">${finalSubmitHtml}</span>`;
                        } else {
                            finalSubmitHtml = `<span style="color: #dc3545; font-weight: bold;">${submitText ? finalSubmitHtml : '미제출'}</span>`;
                        }

                        allAssigns.push({
                            courseName: courseTitleStr,
                            weekNum: currentAssignWeekNum,
                            periodStr: currentAssignPeriod, // 상단의 periodMap 연동 덕에 네비게이션이 정확히 동작합니다.
                            titleHtml: titleTd.innerHTML,
                            dueDateHtml: dueTd ? dueTd.innerHTML : '-',
                            submitStatusHtml: finalSubmitHtml,
                            gradeHtml: gradeTd ? gradeTd.innerHTML : '-',
                            isCompleted: isCompleted,
                            rowBg: rowBgColor
                        });
                    });
                }
            }
        } catch (e) {
            console.error('Error fetching assigns for course ' + courseId, e);
        }
    });

    await Promise.all(fetchPromises);

    if (allItems.length === 0 && allAssigns.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <h3 style="color: #d9534f; margin-bottom: 20px;">출석 및 과제 정보를 불러올 수 없거나 항목이 없습니다.</h3>
                <button id="lms-home-btn" class="btn btn-primary" style="font-size: 15px; padding: 8px 20px;">LMS 홈으로 복귀</button>
            </div>
        `;
        document.getElementById('lms-home-btn').addEventListener('click', () => { window.location.href = '/'; });
        return;
    }

    // 주차별(행 단위)로 데이터 그룹화
    const itemsByWeek = {};
    allItems.forEach(item => {
        if (!itemsByWeek[item.weekNum]) itemsByWeek[item.weekNum] = [];
        itemsByWeek[item.weekNum].push(item);
    });

    const assignsByWeek = {};
    allAssigns.forEach(item => {
        if (!assignsByWeek[item.weekNum]) assignsByWeek[item.weekNum] = [];
        assignsByWeek[item.weekNum].push(item);
    });

    const sortedWeeks = Array.from(new Set([
        ...Object.keys(itemsByWeek).map(Number),
        ...Object.keys(assignsByWeek).map(Number)
    ])).sort((a, b) => a - b);

    // 현재 날짜(월/일)를 기반으로 현재 해당하는 주차 찾기
    let currentWeekIndex = 0;
    const today = new Date();
    const currentYear = today.getFullYear();

    for (let i = 0; i < sortedWeeks.length; i++) {
        const week = sortedWeeks[i];
        let periodStr = '';
        if (itemsByWeek[week] && itemsByWeek[week].length > 0) periodStr = itemsByWeek[week][0].periodStr;
        else if (assignsByWeek[week] && assignsByWeek[week].length > 0) periodStr = assignsByWeek[week][0].periodStr;

        if (!periodStr) continue;

        const dateMatch = periodStr.match(/\[?\s*(\d+)[^\d]+(\d+)[^\d]+(\d+)[^\d]+(\d+)/);

        if (dateMatch) {
            const startMonth = parseInt(dateMatch[1], 10) - 1;
            const startDay = parseInt(dateMatch[2], 10);
            const endMonth = parseInt(dateMatch[3], 10) - 1;
            const endDay = parseInt(dateMatch[4], 10);

            const startDate = new Date(currentYear, startMonth, startDay, 0, 0, 0);
            const endDate = new Date(currentYear, endMonth, endDay, 23, 59, 59);

            if (endMonth < startMonth) {
                endDate.setFullYear(currentYear + 1);
                if (today.getMonth() < startMonth) startDate.setFullYear(currentYear + 1);
            }

            if (today >= startDate && today <= endDate) {
                currentWeekIndex = i;
                break;
            }
        }
    }

    const renderCurrentWeek = () => {
        if (sortedWeeks.length === 0) return;
        const week = sortedWeeks[currentWeekIndex];
        const items = itemsByWeek[week] || [];
        const assigns = assignsByWeek[week] || [];

        let periodStr = '';
        if (items.length > 0) periodStr = items[0].periodStr || '';
        else if (assigns.length > 0) periodStr = assigns[0].periodStr || '';

        // 공통 레이아웃 및 현재 주차 상단 네비게이션
        let htmlContent = `
            <!-- Top Header Card -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding: 20px 30px; background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                <h3 style="color: #1a5e9a; margin: 0; font-weight: bold; font-size: 22px;">호서 LMS+ 대시보드</h3>
                <button id="lms-home-btn" class="btn btn-default btn-outline-secondary" style="font-weight: bold; padding: 6px 16px;">LMS 홈으로 복귀</button>
            </div>
            
            <!-- Current Week Content Card -->
            <div style="background: white; border-radius: 12px; padding: 30px; margin-bottom: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); text-align: left;">
                
                <div style="display: flex; justify-content: center; align-items: center; padding-bottom: 20px; margin-bottom: 25px; border-bottom: 2px solid #f4f6f8;">
                    <button id="dash-prev-btn" style="background: none; border: none; font-size: 24px; cursor: ${currentWeekIndex > 0 ? 'pointer' : 'not-allowed'}; padding: 0 20px; color: ${currentWeekIndex > 0 ? '#1a5e9a' : '#ddd'}; font-weight: bold; transition: color 0.2s;">&lt;</button>
                    <div style="text-align: center; width: 250px;">
                        <h3 style="color: #333; font-weight: bold; margin: 0 0 8px 0; font-size: 24px;">
                            ${week}주차
                        </h3>
                        <div style="font-size: 13px; color: #1a5e9a; background-color: #eef5fa; display: inline-block; padding: 5px 14px; border-radius: 20px; font-weight: bold;">
                            ${periodStr}
                        </div>
                    </div>
                    <button id="dash-next-btn" style="background: none; border: none; font-size: 24px; cursor: ${currentWeekIndex < sortedWeeks.length - 1 ? 'pointer' : 'not-allowed'}; padding: 0 20px; color: ${currentWeekIndex < sortedWeeks.length - 1 ? '#1a5e9a' : '#ddd'}; font-weight: bold; transition: color 0.2s;">&gt;</button>
                </div>
        `;

        if (items.length > 0) {
            htmlContent += `
                <div style="overflow-x: auto; margin-bottom: 30px;">
                    <h4 style="color: #333; font-weight: bold; margin-bottom: 15px; font-size: 17px; display: inline-block;">
                        <span style="color: #1a5e9a; margin-right: 5px;">▶</span> 온라인 출석 현황
                    </h4>
                    <table class="table table-bordered table-hover attendance-custom-table" style="width: 100%; text-align: center; font-size: 14px; background: white;">
                        <thead>
                            <tr style="background-color: #f8f9fa;">
                                <th style="width: 25%; text-align: left; padding-left: 15px;">과목명</th>
                                <th style="width: 40%; text-align: left; padding-left: 15px;">강의 자료</th>
                                <th style="width: 12%;">요구 시간</th>
                                <th style="width: 13%;">누적 열람 시간</th>
                                <th style="width: 10%;">출결</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            items.sort((a, b) => a.courseName.localeCompare(b.courseName));

            let prevCourseName = '';
            items.forEach(item => {
                const isNewCourse = item.courseName !== prevCourseName;
                prevCourseName = item.courseName;

                const borderTop = isNewCourse ? '2px solid #dcdcdc' : '1px solid #f0f0f0';
                const displayCourseName = isNewCourse ? item.courseName : '';

                htmlContent += `
                    <tr style="border-bottom: 1px solid #f0f0f0; border-top: ${borderTop}; background-color: ${item.rowBg};">
                        <td style="font-weight: bold; color: #1a5e9a; text-align: left; padding-left: 15px;">${displayCourseName}</td>
                        <td style="text-align: left; padding-left: 15px;">${item.materialHtml}</td>
                        <td>${item.reqTimeHtml}</td>
                        <td>${item.readTimeHtml}</td>
                        <td>${item.statusHtml}</td>
                    </tr>
                `;
            });

            htmlContent += `
                        </tbody>
                    </table>
                </div>
            `;
        }

        if (assigns.length > 0) {
            htmlContent += `
                <div style="overflow-x: auto; margin-bottom: 10px;">
                    <h4 style="color: #333; font-weight: bold; margin-bottom: 15px; font-size: 17px; display: inline-block;">
                        <span style="color: #1a5e9a; margin-right: 5px;">▶</span> 과제 제출 현황
                    </h4>
                    <table class="table table-bordered table-hover attendance-custom-table" style="width: 100%; text-align: center; font-size: 14px; background: white;">
                        <thead>
                            <tr style="background-color: #f8f9fa;">
                                <th style="width: 25%; text-align: left; padding-left: 15px;">과목명</th>
                                <th style="width: 35%; text-align: left; padding-left: 15px;">과제</th>
                                <th style="width: 15%;">종료 일시</th>
                                <th style="width: 15%;">제출물</th>
                                <th style="width: 10%;">성적</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            assigns.sort((a, b) => a.courseName.localeCompare(b.courseName));

            let prevAssignCourseName = '';
            assigns.forEach(assign => {
                const isNewCourse = assign.courseName !== prevAssignCourseName;
                prevAssignCourseName = assign.courseName;

                const borderTop = isNewCourse ? '2px solid #dcdcdc' : '1px solid #f0f0f0';
                const displayCourseName = isNewCourse ? assign.courseName : '';

                htmlContent += `
                    <tr style="border-bottom: 1px solid #f0f0f0; border-top: ${borderTop}; background-color: ${assign.rowBg};">
                        <td style="font-weight: bold; color: #1a5e9a; text-align: left; padding-left: 15px;">${displayCourseName}</td>
                        <td style="text-align: left; padding-left: 15px;">${assign.titleHtml}</td>
                        <td>${assign.dueDateHtml}</td>
                        <td>${assign.submitStatusHtml}</td>
                        <td>${assign.gradeHtml}</td>
                    </tr>
                `;
            });

            htmlContent += `
                        </tbody>
                    </table>
                </div>
            `;
        }

        htmlContent += `
            </div>
        `;

        // ------------------ 미결석 / 미수강 영상 모아보기 섹션 추가 ------------------
        const incompleteItems = allItems.filter(item => !item.isCompleted);
        const incompleteAssigns = allAssigns.filter(assign => !assign.isCompleted);

        // Incomplete / Completed Status Card
        htmlContent += `
            <div style="background: white; border-radius: 12px; padding: 30px; margin-bottom: 50px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); text-align: left;">
        `;

        if (incompleteItems.length > 0 || incompleteAssigns.length > 0) {
            htmlContent += `
                <div style="margin-bottom: 25px; padding-bottom: 15px; border-bottom: 2px solid #fdf1f2;">
                    <h4 style="color: #d9534f; font-weight: bold; margin: 0; font-size: 18px; display: inline-flex; align-items: center;">
                        <span style="font-size: 20px; margin-right: 8px;">🚨</span> 미수강 및 미제출 항목 (전체 주차)
                    </h4>
                </div>
            `;

            if (incompleteItems.length > 0) {
                htmlContent += `
                    <div style="overflow-x: auto; margin-bottom: 25px;">
                        <h5 style="color: #c9302c; font-weight: bold; margin-bottom: 15px; font-size: 15px;">
                            <span style="margin-right: 5px;">▶</span> 온라인 출석
                        </h5>
                        <table class="table table-bordered table-hover attendance-custom-table" style="width: 100%; text-align: center; font-size: 14px; background: white;">
                            <thead>
                                <tr style="background-color: #fff8f8;">
                                    <th style="width: 15%; text-align: center; color: #c9302c;">해당 주차</th>
                                    <th style="width: 25%; text-align: left; padding-left: 15px; color: #c9302c;">과목명</th>
                                    <th style="width: 35%; text-align: left; padding-left: 15px; color: #c9302c;">강의 자료</th>
                                    <th style="width: 10%; color: #c9302c;">요구 시간</th>
                                    <th style="width: 15%; color: #c9302c;">누적 열람 시간</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                let prevIncompleteCourse = '';
                // 미완료 항목도 과목명 기준으로 1차 정렬
                incompleteItems.sort((a, b) => a.courseName.localeCompare(b.courseName));

                incompleteItems.forEach(item => {
                    const isNewCourse = item.courseName !== prevIncompleteCourse;
                    prevIncompleteCourse = item.courseName;

                    const borderTop = isNewCourse ? '2px solid #f5c6cb' : '1px solid #fdf1f2';
                    const displayCourseName = isNewCourse ? item.courseName : '';

                    htmlContent += `
                        <tr style="border-bottom: 1px solid #fdf1f2; border-top: ${borderTop}; background-color: #fffcfc;">
                            <td style="font-weight: bold; color: #555;">${item.weekNum}주차</td>
                            <td style="font-weight: bold; color: #1a5e9a; text-align: left; padding-left: 15px;">${displayCourseName}</td>
                            <td style="text-align: left; padding-left: 15px;">${item.materialHtml}</td>
                            <td>${item.reqTimeHtml}</td>
                            <td>${item.readTimeHtml}</td>
                        </tr>
                    `;
                });

                htmlContent += `
                                </tbody>
                            </table>
                        </div>
                `;
            }

            if (incompleteAssigns.length > 0) {
                htmlContent += `
                    <div style="overflow-x: auto; margin-bottom: 10px;">
                        <h5 style="color: #c9302c; font-weight: bold; margin-bottom: 15px; font-size: 15px;">
                            <span style="margin-right: 5px;">▶</span> 과제 제출
                        </h5>
                        <table class="table table-bordered table-hover attendance-custom-table" style="width: 100%; text-align: center; font-size: 14px; background: white;">
                            <thead>
                                <tr style="background-color: #fff8f8;">
                                    <th style="width: 15%; text-align: center; color: #c9302c;">해당 주차</th>
                                    <th style="width: 25%; text-align: left; padding-left: 15px; color: #c9302c;">과목명</th>
                                    <th style="width: 35%; text-align: left; padding-left: 15px; color: #c9302c;">과제</th>
                                    <th style="width: 15%; color: #c9302c;">종료 일시</th>
                                    <th style="width: 10%; color: #c9302c;">제출물</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                let prevIncompleteAssignCourse = '';
                // 과제 미완료 항목도 과목명 기준으로 1차 정렬
                incompleteAssigns.sort((a, b) => a.courseName.localeCompare(b.courseName));

                incompleteAssigns.forEach(assign => {
                    const isNewCourse = assign.courseName !== prevIncompleteAssignCourse;
                    prevIncompleteAssignCourse = assign.courseName;

                    const borderTop = isNewCourse ? '2px solid #f5c6cb' : '1px solid #fdf1f2';
                    const displayCourseName = isNewCourse ? assign.courseName : '';

                    htmlContent += `
                        <tr style="border-bottom: 1px solid #fdf1f2; border-top: ${borderTop}; background-color: #fffcfc;">
                            <td style="font-weight: bold; color: #555;">${assign.weekNum}주차</td>
                            <td style="font-weight: bold; color: #1a5e9a; text-align: left; padding-left: 15px;">${displayCourseName}</td>
                            <td style="text-align: left; padding-left: 15px;">${assign.titleHtml}</td>
                            <td>${assign.dueDateHtml}</td>
                            <td>${assign.submitStatusHtml}</td>
                        </tr>
                    `;
                });

                htmlContent += `
                                </tbody>
                            </table>
                        </div>
                `;
            }

        } else {
            htmlContent += `
                <div style="text-align: center; padding: 40px 20px;">
                    <h3 style="color: #28a745; font-weight: bold; margin: 0; font-size: 20px;">
                        🎉 모든 주차의 수강을 완료하고 과제를 제출했습니다!
                    </h3>
                </div>
            `;
        }

        htmlContent += `
            </div>
        `;

        listContainer.innerHTML = htmlContent;
        listContainer.style.textAlign = 'center';

        const homeBtn = document.getElementById('lms-home-btn');
        if (homeBtn) {
            homeBtn.addEventListener('click', () => { window.location.href = '/'; });
        }

        document.getElementById('dash-prev-btn').addEventListener('click', () => {
            if (currentWeekIndex > 0) {
                currentWeekIndex--;
                renderCurrentWeek();
            }
        });

        document.getElementById('dash-next-btn').addEventListener('click', () => {
            if (currentWeekIndex < sortedWeeks.length - 1) {
                currentWeekIndex++;
                renderCurrentWeek();
            }
        });
    };

    // 처음 렌더링 실행
    renderCurrentWeek();

    if (!document.getElementById('attendance-custom-styles')) {
        const style = document.createElement('style');
        style.id = 'attendance-custom-styles';
        style.textContent = `
            .attendance-custom-table th, .attendance-custom-table td {
                vertical-align: middle !important;
            }
            .attendance-custom-table th {
                font-weight: bold;
            }
            .attendance-custom-table img {
                width: 18px;
                height: 18px;
                vertical-align: middle;
                margin-right: 8px;
            }
            .attendance-custom-table a {
                color: #1a5e9a;
                text-decoration: none;
                font-weight: bold;
            }
            .attendance-custom-table a:hover {
                text-decoration: underline;
                color: #003366;
            }
            #lms-custom-dashboard td {
                border-bottom: 1px solid #dee2e6;
            }
        `;
        document.head.appendChild(style);
    }
};

function addCalendarTab() {
    const containerList = document.querySelector('#mCSB_1_container > ul');

    if (containerList && !document.getElementById('lms-calendar-tab')) {
        const calendarTab = document.createElement('li');
        calendarTab.id = 'lms-calendar-tab';
        calendarTab.className = 'menu-item';

        const a = document.createElement('a');
        a.href = '#';
        // Add exact space formatting so the LMS CSS parses it as no submenu
        a.className = 'site-menu-link nosubmenu ';
        a.title = '호서 LMS+ 대시보드';
        a.style.cursor = 'pointer';

        a.innerHTML = `
            <i class="fa site-menu-icon fa-th-list" aria-hidden="true"></i>
            <div class="text-truncate">호서 LMS+</div>
        `;

        calendarTab.appendChild(a);
        containerList.appendChild(calendarTab);

        // 클릭 시 URL 이동 없이 현재 페이지의 내용만 변경
        a.addEventListener('click', (e) => {
            e.preventDefault();
            replacePageContent();
        });

        console.log('[hoseo-lms-plus] Dashboard tab injected.');
    } else if (!document.getElementById('lms-calendar-tab')) {
        setTimeout(addCalendarTab, 1000);
    }
}

// 오직 메인 페이지에서만 작동하도록 제한 (하위 페이지는 거부)
if (window.location.pathname === '/' || window.location.pathname === '/index.php') {
    // 스크립트 실행 시 탭 추가 (일반적인 페이지 로드 시)
    addCalendarTab();

    // 사이드바 구조가 동적으로 변경(새로고침 없이 렌더링)될 경우를 대비해 지속적으로 관찰
    const observer = new MutationObserver(() => {
        const containerList = document.querySelector('#mCSB_1_container > ul');
        if (containerList && !document.getElementById('lms-calendar-tab')) {
            addCalendarTab();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}
