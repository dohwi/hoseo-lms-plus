(function (global, factory) {
    const exports = factory(global.HoseoLmsPlusCore, global.HoseoLmsPlusParsers);
    global.HoseoLmsPlusDataService = exports;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = exports;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core, parsers) {
    'use strict';

    // ============================================================
    // 매칭 정책
    // ============================================================
    // 활동(Activity)과 출석/과제/퀴즈 항목을 연결하는 2단계 매칭:
    //
    // 1차 — 키 매칭 (findMatchedByKey):
    //   core.buildActivityKey()로 양쪽 항목의 안정적인 식별자를 추출
    //   (activityKey 우선 → URL query param → 정규화된 이름)
    //   같은 키면 동일 활동으로 판정. 가장 정확.
    //
    // 2차 — 이름 부분 매칭 (findMatchedItem + matchesNormalizedText):
    //   1차에서 매칭 실패 시 이름 기반 매칭으로 보완
    //   [퀴즈] 접두사 제거, 괄호/특수문자 정규화 후 부분 일치 검사
    //
    // 미매칭 → 해당 항목은 isNeutral=true로 표시 (상태 확인 불가)
    // ============================================================

    const OTHER_WEEK_NUM = core.OTHER_WEEK_NUM;
    const BASE_URL = core.DEFAULT_BASE_URL;
    const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
    const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

    function create(runtime) {
        runtime = runtime || {};
        const requestTimeoutMs = Number.isFinite(runtime.requestTimeoutMs)
            ? Math.max(1, runtime.requestTimeoutMs)
            : DEFAULT_REQUEST_TIMEOUT_MS;
        const maxResponseBytes = Number.isFinite(runtime.maxResponseBytes)
            ? Math.max(1, runtime.maxResponseBytes)
            : MAX_RESPONSE_BYTES;

        function isLoginFormHtml(html) {
            if (!html || !/<form\b/i.test(html)) return false;
            const doc = typeof DOMParser !== 'undefined' ? new DOMParser().parseFromString(html, 'text/html') : null;
            if (!doc) return /<input[^>]+type=["']?password/i.test(html);
            return Array.from(doc.querySelectorAll('form')).some(function (form) {
                const action = String(form.getAttribute('action') || '');
                let isLoginAction = false;
                try {
                    isLoginAction = new URL(action, BASE_URL).pathname.startsWith('/login/');
                } catch {
                    isLoginAction = false;
                }
                const hasPassword = Boolean(form.querySelector('input[type="password"], input[name="password" i]'));
                const hasUsername = Boolean(form.querySelector('input[name="username" i], input[id="username" i]'));
                return hasPassword && (hasUsername || isLoginAction);
            });
        }

        function fetchText(url, endpointName, requestMemo) {
            if (!core.isSafeUrl(url, BASE_URL)) {
                return Promise.resolve({ response: null, text: '', error: endpointName + ' 요청 URL이 허용되지 않았습니다.' });
            }
            const safeUrl = new URL(url, BASE_URL).toString();
            if (requestMemo && requestMemo.has(safeUrl)) return requestMemo.get(safeUrl);
            const request = runtime.getRequestQueue().enqueue(async function (signal) {
                const controller = new AbortController();
                let timedOut = false;
                const abortFromQueue = function () { controller.abort(); };
                if (signal && typeof signal.addEventListener === 'function') {
                    if (signal.aborted) controller.abort();
                    else signal.addEventListener('abort', abortFromQueue, { once: true });
                }
                const timeoutId = setTimeout(function () {
                    timedOut = true;
                    controller.abort();
                }, requestTimeoutMs);

                try {
                    const response = await fetch(safeUrl, { signal: controller.signal, credentials: 'same-origin' });
                    if (response && response.url && response.url.includes(core.LOGIN_PATTERN)) {
                        return { response: response, text: '', sessionExpired: true };
                    }
                    if (!response || !response.ok) {
                        const status = response && response.status ? ' (HTTP ' + response.status + ')' : '';
                        return { response: response, text: '', error: endpointName + ' 정보를 불러오지 못했습니다.' + status };
                    }
                    const contentLength = Number(response.headers && response.headers.get && response.headers.get('content-length'));
                    if (Number.isFinite(contentLength) && contentLength > maxResponseBytes) {
                        return { response: response, text: '', error: endpointName + ' 응답 크기가 허용 한도를 초과했습니다.' };
                    }
                    const text = await response.text();
                    if (core.utf8ByteLength(text) > maxResponseBytes) {
                        return { response: response, text: '', error: endpointName + ' 응답 크기가 허용 한도를 초과했습니다.' };
                    }
                    if (isLoginFormHtml(text)) return { response: response, text: '', sessionExpired: true };
                    return { response: response, text: text };
                } catch (error) {
                    if (signal && signal.aborted) throw error;
                    if (error && error.name === 'AbortError' && !timedOut) throw error;
                    if (timedOut) return { response: null, text: '', error: endpointName + ' 요청 시간이 초과되었습니다.' };
                    return { response: null, text: '', error: endpointName + ' 요청에 실패했습니다.' };
                } finally {
                    clearTimeout(timeoutId);
                    if (signal && typeof signal.removeEventListener === 'function') {
                        signal.removeEventListener('abort', abortFromQueue);
                    }
                }
            });
            if (requestMemo) {
                requestMemo.set(safeUrl, request);
                request.catch(function () {
                    if (requestMemo.get(safeUrl) === request) requestMemo.delete(safeUrl);
                });
            }
            return request;
        }

        function normalizeActivityName(value) {
            return core.normalizeComparableText(String(value || '').replace(/^\s*\[퀴즈\]\s*/i, ' '));
        }

        function findMatchedByKey(activity, primaryItems, fallbackItems) {
            const targetKey = core.buildActivityKey(activity, BASE_URL);
            if (!targetKey) return null;
            const primaryMatch = (primaryItems || []).find(function (item) {
                return core.buildActivityKey(item, BASE_URL) === targetKey;
            });
            if (primaryMatch) return primaryMatch;
            return (fallbackItems || []).find(function (item) {
                return core.buildActivityKey(item, BASE_URL) === targetKey;
            }) || null;
        }

        function buildExtraInfo(label, value) {
            return '<span class="lms-extra-info">(' + label + ': ' + value + ')</span>';
        }

        function appendExtraInfo(optionsHtml, extraHtml) {
            return optionsHtml ? optionsHtml + '<br>' + extraHtml : extraHtml;
        }

        function matchesNormalizedText(left, right) {
            const normalizedLeft = normalizeActivityName(left);
            const normalizedRight = normalizeActivityName(right);
            if (!normalizedLeft || !normalizedRight) return false;
            return normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft);
        }

        function findMatchedItem(primaryItems, fallbackItems, matcher) {
            const primaryMatch = (primaryItems || []).find(matcher);
            if (primaryMatch) return primaryMatch;
            return (fallbackItems || []).find(matcher) || null;
        }

        async function fetchAssignmentDetails(assignments, requestMemo) {
            return Promise.all(assignments.map(async (assignment) => {
                const item = Object.assign({}, assignment, {
                    statusText: assignment.isCompleted ? assignment.submitText || '제출 완료' : '미제출',
                    isNeutral: false
                });
                if (!item.isCompleted && item.viewUrl) {
                    const result = await fetchText(item.viewUrl, item.courseName + ' 과제 상세', requestMemo);
                    if (result.text && result.text.includes('과제에서 온라인 제출물을 요구하지 않습니다')) {
                        item.statusText = '제출 불필요';
                        item.isCompleted = true;
                        item.isNeutral = true;
                    }
                }
                return item;
            }));
        }

        async function fetchQuizDetails(quizzes, requestMemo) {
            const resolved = await Promise.all(quizzes.map(async (quiz) => {
                const item = Object.assign({}, quiz, {
                    statusText: quiz.isCompleted ? '제출됨' : '미응시'
                });
                if (!item.isCompleted && item.viewUrl) {
                    const result = await fetchText(item.viewUrl, item.courseName + ' 퀴즈 상세', requestMemo);
                    if (result.text) {
                        const status = parsers.parseQuizAttemptStatus(result.text);
                        item.isCompleted = status.isCompleted;
                        item.statusText = status.finalStatusText;
                    }
                }
                return item;
            }));
            return resolved.map((quiz) => Object.assign({}, quiz, {
                titleHtml: '<span>[퀴즈]</span> ' + quiz.titleHtml,
                isNeutral: false
            }));
        }

        function isVideoType(type) {
            return type.includes('동영상') || type.includes('VOD') || type.includes('Page');
        }

        function isAssignType(type) {
            return type.includes('과제') || type.includes('퀴즈') || type.includes('Assignment') || type.includes('Quiz');
        }

        function buildActivities(courseId, courseName, sourceActivities, attendanceItems, assignments, quizzes) {
            const activities = [];
            const allAssignments = assignments.concat(quizzes);
            const itemsByWeek = core.groupByWeek(attendanceItems);
            const assignsByWeek = core.groupByWeek(allAssignments);

            sourceActivities.forEach((activity) => {
                let statusText = '-';
                let isCompleted = false;
                let isNeutral = activity.isIgnoredType;
                let optionsHtml = activity.optionsHtml || '';
                const cleanName = core.stripHtml(activity.nameHtml);
                let isMatchedVideo = false;
                let isMatchedAssignment = false;

                if (!activity.isIgnoredType && isVideoType(activity.type)) {
                    const matchedVideo = findMatchedByKey(activity, itemsByWeek.get(activity.weekNum), attendanceItems)
                        || findMatchedItem(itemsByWeek.get(activity.weekNum), attendanceItems, function (item) {
                            return matchesNormalizedText(item.materialHtml, cleanName);
                        });
                    if (matchedVideo) {
                        statusText = matchedVideo.isCompleted ? core.stripHtml(matchedVideo.statusHtml) || '완료' : core.stripHtml(matchedVideo.statusHtml) || '미완료';
                        isCompleted = matchedVideo.isCompleted;
                        isNeutral = false;
                        isMatchedVideo = true;
                        const extra = buildExtraInfo('요구/누적', core.stripBr(matchedVideo.reqTimeHtml) + ' / ' + core.stripBr(matchedVideo.readTimeHtml));
                        optionsHtml = appendExtraInfo(optionsHtml, extra);
                    }
                } else if (!activity.isIgnoredType && isAssignType(activity.type)) {
                    const matchedAssign = findMatchedByKey(activity, assignsByWeek.get(activity.weekNum), allAssignments)
                        || findMatchedItem(assignsByWeek.get(activity.weekNum), allAssignments, function (item) {
                            return matchesNormalizedText(item.titleHtml, cleanName);
                        });
                    if (matchedAssign) {
                        statusText = matchedAssign.statusText || (matchedAssign.isCompleted ? '완료' : '미완료');
                        isCompleted = matchedAssign.isCompleted;
                        isNeutral = Boolean(matchedAssign.isNeutral);
                        isMatchedAssignment = true;
                        if (!optionsHtml && matchedAssign.dueDateHtml && matchedAssign.dueDateHtml !== '-') {
                            optionsHtml = matchedAssign.dueDateHtml;
                        }
                        const extra = buildExtraInfo('성적', core.stripBr(matchedAssign.gradeHtml));
                        optionsHtml = appendExtraInfo(optionsHtml, extra);
                    }
                }

                if (!isMatchedAssignment && !isMatchedVideo) {
                    isNeutral = true;
                    statusText = '-';
                }

                if (activity.isCourseNotice) return;
                if (activity.weekNum === core.OTHER_WEEK_NUM && isNeutral) return;

                activities.push({
                    courseId: courseId,
                    courseName: courseName,
                    weekNum: activity.weekNum,
                    periodStr: activity.periodStr,
                    type: activity.type,
                    href: activity.href,
                    nameHtml: activity.nameHtml,
                    optionsHtml: optionsHtml || '-',
                    statusText: statusText,
                    isCompleted: isCompleted,
                    isNeutral: isNeutral
                });
            });

            return activities;
        }

        async function fetchCourseData(courseId, isIrregular, requestMemo) {
            const courseTitle = '강좌 ' + courseId;
            const warnings = [];
            const endpoints = await Promise.all([
                fetchText(BASE_URL + '/local/ubonattend/my_status.php?id=' + courseId, courseTitle + ' 출석', requestMemo),
                fetchText(BASE_URL + '/mod/assign/index.php?id=' + courseId, courseTitle + ' 과제', requestMemo),
                fetchText(BASE_URL + '/mod/quiz/index.php?id=' + courseId, courseTitle + ' 퀴즈', requestMemo),
                fetchText(BASE_URL + '/course/view.php?id=' + courseId, courseTitle + ' 강좌 메인', requestMemo)
            ]);

            if (endpoints.some((endpoint) => endpoint.sessionExpired)) {
                return { courseId: courseId, courseName: courseTitle, items: [], assigns: [], activities: [], warnings: [], sessionExpired: true };
            }

            const attendanceResult = endpoints[0].text
                ? parsers.parseAttendancePage(endpoints[0].text, courseId, BASE_URL)
                : { items: [], courseName: courseTitle, periodMap: {} };
            const courseName = attendanceResult.courseName || courseTitle;

            endpoints.forEach((endpoint) => {
                if (endpoint.error) warnings.push(courseName + ': ' + endpoint.error);
            });

            const assignmentSummary = endpoints[1].text
                ? parsers.parseAssignmentIndexPage(endpoints[1].text, courseId, courseName, attendanceResult.periodMap, BASE_URL)
                : [];
            const quizSummary = endpoints[2].text
                ? parsers.parseQuizIndexPage(endpoints[2].text, courseId, courseName, attendanceResult.periodMap, BASE_URL)
                : [];
            const sourceActivities = endpoints[3].text
                ? parsers.parseCourseViewPage(endpoints[3].text, courseId, courseName, attendanceResult.periodMap, BASE_URL)
                : [];
            // 과제/퀴즈 상세는 강좌 메인·공지 응답과 무관하므로 먼저 시작해 대기열 뒤로 밀리지 않게 한다.
            const detailsPromise = Promise.all([
                fetchAssignmentDetails(assignmentSummary, requestMemo),
                fetchQuizDetails(quizSummary, requestMemo)
            ]);
            const noticeBoardUrls = Array.from(new Set(sourceActivities
                .filter(function (activity) { return activity.isCourseNotice; })
                .map(function (activity) { return activity.href; })));
            const noticeResults = await Promise.all(noticeBoardUrls.map(function (url) {
                return fetchText(url, courseName + ' 공지사항', requestMemo);
            }));
            const noticeActivities = [];
            const noticeSessionExpired = noticeResults.some(function (result) { return result.sessionExpired; });
            noticeResults.forEach(function (result, index) {
                if (result.text) {
                    noticeActivities.push(...parsers.parseUbboardNoticePage(
                        result.text,
                        courseId,
                        courseName,
                        attendanceResult.periodMap,
                        BASE_URL,
                        new Date(),
                        (result.response && result.response.url) || noticeBoardUrls[index]
                    ));
                } else if (result.error) {
                    warnings.push(courseName + ': ' + result.error);
                } else if (result.sessionExpired) {
                    warnings.push(courseName + ': 공지사항 정보를 불러오지 못했습니다. 로그인 페이지로 이동되었습니다.');
                }
            });

            const details = await detailsPromise;
            const assignments = details[0];
            const quizzes = details[1];

            const items = attendanceResult.items;
            const assigns = assignments.concat(quizzes);
            const activities = buildActivities(courseId, courseName, sourceActivities, items, assignments, quizzes).concat(noticeActivities);

            if (isIrregular) {
                items.forEach((item) => { item.weekNum = OTHER_WEEK_NUM; item.periodStr = '기타'; });
                assigns.forEach((item) => { item.weekNum = OTHER_WEEK_NUM; item.periodStr = '기타'; });
                activities.forEach((item) => { item.weekNum = OTHER_WEEK_NUM; item.periodStr = '기타'; });
            }

            return {
                courseId: courseId,
                courseName: courseName,
                items: items,
                assigns: assigns,
                activities: activities,
                warnings: warnings,
                sessionExpired: noticeSessionExpired,
                isIrregular: Boolean(isIrregular),
                periodMap: attendanceResult.periodMap || {}
            };
        }

        // 마감일 텍스트(여러 날짜 중 마지막)에서 {year, month, day} 추출
        function extractDueDate(html) {
            const text = core.stripHtml(html || '');
            const matches = Array.from(text.matchAll(/(\d{4})-(\d{2})-(\d{2})/g));
            if (!matches.length) return null;
            const last = matches[matches.length - 1];
            return { year: Number(last[1]), month: Number(last[2]), day: Number(last[3]) };
        }

        // 모든 강좌의 (주차, 기간) 쌍을 모아 강좌 수를 센다. 주차 번호는 강좌마다 다를 수 있으므로 번호로 합치지 않는다.
        function collectPeriodCandidates(results) {
            const counts = new Map();
            results.forEach((result) => {
                if (result.isIrregular) return;
                Object.keys(result.periodMap || {}).forEach((week) => {
                    const dates = String(result.periodMap[week]).match(/(\d{1,2})\D+(\d{1,2})\D+(\d{1,2})\D+(\d{1,2})/);
                    if (!dates) return;
                    const key = week + '|' + result.periodMap[week];
                    if (!counts.has(key)) {
                        counts.set(key, {
                            week: Number(week),
                            period: result.periodMap[week],
                            start: Number(dates[1]) * 100 + Number(dates[2]),
                            end: Number(dates[3]) * 100 + Number(dates[4]),
                            count: 0
                        });
                    }
                    counts.get(key).count += 1;
                });
            });
            return Array.from(counts.values());
        }

        // 마감일이 속한 주차 후보 중 가장 많은 강좌가 쓰는(일반 학기 달력) 주차를 선택
        function findWeekForDate(candidates, due) {
            const value = due.month * 100 + due.day;
            return candidates
                .filter((entry) => (entry.start <= entry.end
                    ? value >= entry.start && value <= entry.end
                    : value >= entry.start || value <= entry.end)) // 연말→연초에 걸친 주차
                .sort((left, right) => right.count - left.count || left.week - right.week)[0] || null;
        }

        // 강좌마다 주차 번호가 달라도(예: 비교과 5주차 = 일반 8주차) 섹션 기간의 시작일 기준으로 공통 주차에 맞춘다.
        function remapWeeksByPeriod(results, candidates) {
            if (!candidates.length) return;
            results.forEach((result) => {
                if (result.isIrregular) return;
                [result.items, result.assigns, result.activities].forEach((list) => {
                    list.forEach((item) => {
                        if (item.weekNum === OTHER_WEEK_NUM) return;
                        const match = String(item.periodStr || '').match(/(\d{1,2})\D+(\d{1,2})\D+\d{1,2}\D+\d{1,2}/);
                        if (!match) return;
                        const found = findWeekForDate(candidates, { month: Number(match[1]), day: Number(match[2]) });
                        if (found) {
                            item.weekNum = found.week;
                            item.periodStr = found.period;
                        }
                    });
                });
            });
        }

        // 주차 섹션이 없는 정규/비교과 강좌의 항목은 마감일이 속한 주차로 배정 (MOOC 등 irregular는 제외)
        function assignWeekByDueDate(results, candidates, getDueHtml, getList) {
            if (!candidates.length) return;
            const currentYear = new Date().getFullYear();
            results.forEach((result) => {
                if (result.isIrregular) return;
                getList(result).forEach((item) => {
                    if (item.weekNum !== OTHER_WEEK_NUM) return;
                    const due = extractDueDate(getDueHtml(item));
                    if (!due || due.year !== currentYear) return;
                    const found = findWeekForDate(candidates, due);
                    if (found) {
                        item.weekNum = found.week;
                        item.periodStr = found.period;
                    }
                });
            });
        }

        async function fetchAllCourseData(courseInfoList, onProgress) {
            const requestMemo = new Map();
            let loaded = 0;
            let sessionExpired = false;
            const results = await Promise.all(courseInfoList.map(async (courseInfo) => {
                const result = await fetchCourseData(courseInfo.id, courseInfo.isIrregular, requestMemo);
                loaded += 1;
                if (onProgress) onProgress(loaded, courseInfoList.length);
                if (result.sessionExpired) sessionExpired = true;
                return result;
            }));

            const mergedPeriods = collectPeriodCandidates(results);
            remapWeeksByPeriod(results, mergedPeriods);
            assignWeekByDueDate(results, mergedPeriods, function (item) { return item.dueDateHtml; }, function (result) { return result.assigns; });
            assignWeekByDueDate(results, mergedPeriods, function (item) { return item.optionsHtml; }, function (result) { return result.activities; });

            const allCourseNamesSet = new Set();
            const warnings = [];
            const allItems = [];
            const allAssigns = [];
            const allActivities = [];

            results.forEach((result) => {
                if (result.courseName) allCourseNamesSet.add(result.courseName);
                allItems.push(...result.items);
                allAssigns.push(...result.assigns);
                allActivities.push(...result.activities);
                warnings.push(...result.warnings);
            });

            return {
                allItems: allItems,
                allAssigns: allAssigns,
                allActivities: allActivities,
                allCourseNames: Array.from(allCourseNamesSet).sort()
                    .map((name) => ({ courseName: name })),
                warnings: warnings,
                sessionExpired: sessionExpired
            };
        }

        return {
            fetchAllCourseData: fetchAllCourseData
        };
    }

    return {
        create: create
    };
});
