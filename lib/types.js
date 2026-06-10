/**
 * @fileoverview 호서 LMS+ 타입 정의
 * @typedef {Object} Activity
 * @property {string} courseId - 강좌 ID
 * @property {string} courseName - 강좌명
 * @property {number} weekNum - 주차 번호 (0 = 기타/MOOC)
 * @property {string} periodStr - 기간 문자열 (예: "[03.01~03.07]")
 * @property {string} type - 활동 유형 (예: "동영상", "과제")
 * @property {string} href - 활동 링크
 * @property {string} nameHtml - 활동명 HTML (새니타이즈 완료)
 * @property {string} optionsHtml - 옵션 HTML (기간, 성적 등)
 * @property {string} statusText - 상태 텍스트 ("완료", "미완료", "미응시", "-")
 * @property {boolean} isCompleted - 완료 여부 (출석/제출/응시 기준)
 * @property {boolean} isNeutral - 중립 상태 여부 (파일/토론 등 완수 판정 불가 항목)
 * @property {string} [activityKey] - 활동 식별자 URL (매칭 키)
 */

/**
 * @typedef {Object} AttendanceItem
 * @property {string} courseId - 강좌 ID
 * @property {string} courseName - 강좌명
 * @property {number} weekNum - 주차 번호
 * @property {string} periodStr - 기간 문자열
 * @property {string|null} materialHref - 학습 자료 링크
 * @property {string} materialHtml - 학습 자료명 HTML
 * @property {string} reqTimeHtml - 요구 시간 HTML
 * @property {string} readTimeHtml - 학습 시간 HTML
 * @property {string} statusHtml - 상태 HTML
 * @property {boolean} isCompleted - 완료 여부 (O/100%/완료 기준)
 */

/**
 * @typedef {Object} Assignment
 * @property {string} courseId - 강좌 ID
 * @property {string} courseName - 강좌명
 * @property {number} weekNum - 주차 번호
 * @property {string} periodStr - 기간 문자열
 * @property {string} activityKey - 활동 식별자 (매칭 및 dedup 키)
 * @property {string} titleHtml - 제목 HTML
 * @property {string} dueDateHtml - 마감일 HTML
 * @property {string} submitHtml - 제출 상태 HTML
 * @property {string} submitText - 제출 상태 텍스트
 * @property {string} gradeHtml - 성적 HTML
 * @property {string|null} viewUrl - 상세 보기 URL
 * @property {boolean} isCompleted - 완료 여부 (제출 완료 기준)
 * @property {boolean} [isNeutral] - 중립 상태 여부 (제출 불필요 과제 등)
 */

/**
 * @typedef {Object} UserContext
 * @property {string} userId - 사용자 ID (data-userid 또는 username fallback)
 */

/**
 * @typedef {Object} CacheEntry
 * @property {number} timestamp - 캐시 생성 시간 (epoch ms)
 * @property {Object} data - 캐시된 AllCourseData
 */

/**
 * @typedef {Object} CourseData
 * @property {string} courseId - 강좌 ID
 * @property {string} courseName - 강좌명
 * @property {AttendanceItem[]} items - 출석 항목 배열
 * @property {Assignment[]} assigns - 과제/퀴즈 배열
 * @property {Activity[]} activities - 연계 활동 배열 (isNeutral: 파일/토론, isCompleted: 매칭 상태 반영)
 * @property {string[]} warnings - 경고 메시지 배열
 * @property {boolean} sessionExpired - 세션 만료 여부
 */

/**
 * @typedef {Object} AllCourseData
 * @property {AttendanceItem[]} allItems - 전체 출석 항목
 * @property {Assignment[]} allAssigns - 전체 과제/퀴즈
 * @property {Activity[]} allActivities - 전체 연계 활동
 * @property {Object[]} allCourseNames - 전체 강좌명 배열 ({courseName})
 * @property {string[]} warnings - 모든 강좌의 경고 메시지
 * @property {boolean} sessionExpired - 전체 세션 만료 여부
 */

module.exports = {};
