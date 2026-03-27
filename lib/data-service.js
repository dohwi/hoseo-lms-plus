(function (global, factory) {
    const exports = factory(global.HoseoLmsPlusCore, global.HoseoLmsPlusParsers);
    global.HoseoLmsPlusDataService = exports;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = exports;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core, parsers) {
    'use strict';

    const BASE_URL = core.DEFAULT_BASE_URL;

    function create(runtime) {
        function fetchText(url, endpointName) {
            return runtime.getRequestQueue().enqueue(async function (signal) {
                try {
                    const response = await fetch(url, { signal: signal, credentials: 'same-origin' });
                    if (response && response.url && response.url.includes(core.LOGIN_PATTERN)) {
                        return { response: response, text: '', sessionExpired: true };
                    }
                    if (!response || !response.ok) {
                        return { response: response, text: '', error: endpointName + ' 정보를 불러오지 못했습니다.' };
                    }
                    return { response: response, text: await response.text() };
                } catch (error) {
                    if (error && error.name === 'AbortError') throw error;
                    return { response: null, text: '', error: endpointName + ' 요청에 실패했습니다.' };
                }
            });
        }

        function normalizeActivityName(value) {
            return core.normalizeComparableText(String(value || '').replace(/^\s*\[퀴즈\]\s*/i, ' '));
        }

        function isSameActivity(activity, candidate, htmlField, urlField) {
            const activityKey = activity.activityKey || core.getActivityIdentifier(activity.href, BASE_URL);
            const candidateKey = candidate.activityKey || core.getActivityIdentifier(candidate[urlField], BASE_URL);
            if (activityKey && candidateKey) return activityKey === candidateKey;
            return normalizeActivityName(activity.nameHtml) === normalizeActivityName(candidate[htmlField]);
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

        async function fetchAssignmentDetails(assignments) {
            return Promise.all(assignments.map(async (assignment) => {
                const item = Object.assign({}, assignment, {
                    statusText: assignment.isCompleted ? assignment.submitText || '제출 완료' : '미제출',
                    isNeutral: false
                });
                if (!item.isCompleted && item.viewUrl) {
                    const result = await fetchText(item.viewUrl, item.courseName + ' 과제 상세');
                    if (result.text && result.text.includes('과제에서 온라인 제출물을 요구하지 않습니다')) {
                        item.statusText = '제출 불필요';
                        item.isCompleted = true;
                        item.isNeutral = true;
                    }
                }
                return item;
            }));
        }

        async function fetchQuizDetails(quizzes) {
            const resolved = await Promise.all(quizzes.map(async (quiz) => {
                const item = Object.assign({}, quiz, {
                    statusText: quiz.isCompleted ? '제출됨' : '미응시'
                });
                if (!item.isCompleted && item.viewUrl) {
                    const result = await fetchText(item.viewUrl, item.courseName + ' 퀴즈 상세');
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
            const itemsByWeek = core.groupByWeek(attendanceItems);
            const assignsByWeek = core.groupByWeek(assignments.concat(quizzes));

            sourceActivities.forEach((activity) => {
                let statusText = '-';
                let isCompleted = false;
                let isNeutral = activity.isIgnoredType;
                let optionsHtml = activity.optionsHtml || '';
                const cleanName = core.stripHtml(activity.nameHtml);
                let isMatchedVideo = false;
                let isMatchedAssignment = false;

                if (!activity.isIgnoredType && isVideoType(activity.type)) {
                    const matchedVideo = findMatchedItem(itemsByWeek.get(activity.weekNum), attendanceItems, (item) => {
                        if (isSameActivity(activity, item, 'materialHtml', 'materialHref')) return true;
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
                    const matchedAssign = findMatchedItem(assignsByWeek.get(activity.weekNum), assignments.concat(quizzes), (item) => {
                        if (isSameActivity(activity, item, 'titleHtml', 'viewUrl')) return true;
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

        async function fetchCourseData(courseId) {
            const courseTitle = '강좌 ' + courseId;
            const warnings = [];
            const endpoints = await Promise.all([
                fetchText(BASE_URL + '/local/ubonattend/my_status.php?id=' + courseId, courseTitle + ' 출석'),
                fetchText(BASE_URL + '/mod/assign/index.php?id=' + courseId, courseTitle + ' 과제'),
                fetchText(BASE_URL + '/mod/quiz/index.php?id=' + courseId, courseTitle + ' 퀴즈'),
                fetchText(BASE_URL + '/course/view.php?id=' + courseId, courseTitle + ' 강좌 메인')
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

            const details = await Promise.all([
                fetchAssignmentDetails(assignmentSummary),
                fetchQuizDetails(quizSummary)
            ]);
            const assignments = details[0];
            const quizzes = details[1];

            return {
                courseId: courseId,
                courseName: courseName,
                items: attendanceResult.items,
                assigns: assignments.concat(quizzes),
                activities: buildActivities(courseId, courseName, sourceActivities, attendanceResult.items, assignments, quizzes),
                warnings: warnings,
                sessionExpired: false
            };
        }

        async function fetchAllCourseData(courseIds, onProgress) {
            let loaded = 0;
            let sessionExpired = false;
            const results = await Promise.all(courseIds.map(async (courseId) => {
                const result = await fetchCourseData(courseId);
                loaded += 1;
                if (onProgress) onProgress(loaded, courseIds.length);
                if (result.sessionExpired) sessionExpired = true;
                return result;
            }));

            const allCourseNamesMap = new Map();
            const warnings = [];
            const allItems = [];
            const allAssigns = [];
            const allActivities = [];

            results.forEach((result) => {
                if (result.courseName) allCourseNamesMap.set(result.courseName, result.courseId);
                allItems.push(...result.items);
                allAssigns.push(...result.assigns);
                allActivities.push(...result.activities);
                warnings.push(...result.warnings);
            });

            return {
                allItems: allItems,
                allAssigns: allAssigns,
                allActivities: allActivities,
                allCourseNames: Array.from(allCourseNamesMap.entries())
                    .map((entry) => ({ courseName: entry[0], courseId: entry[1] }))
                    .sort((left, right) => left.courseName.localeCompare(right.courseName)),
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
