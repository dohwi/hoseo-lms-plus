/**
 * @fileoverview 호서 LMS+ 타입 정의
 * @typedef {Object} Activity
 * @property {string} courseId - 강좌 ID
 * @property {string} courseName - 강좌명
 * @property {number} weekNum - 주차 번호
 * @property {string} periodStr - 기간 문자열
 * @property {string} type - 활동 유형
 * @property {string} href - 활동 링크
 * @property {string} nameHtml - 활동명 HTML
 * @property {string} optionsHtml - 옵션 HTML
 * @property {string} statusText - 상태 텍스트
 * @property {boolean} isCompleted - 완료 여부
 * @property {boolean} isNeutral - 중립 상태 여부
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
 * @property {boolean} isCompleted - 완료 여부
 */

/**
 * @typedef {Object} Assignment
 * @property {string} courseId - 강좌 ID
 * @property {string} courseName - 강좌명
 * @property {number} weekNum - 주차 번호
 * @property {string} periodStr - 기간 문자열
 * @property {string} activityKey - 활동 식별자
 * @property {string} titleHtml - 제목 HTML
 * @property {string} dueDateHtml - 마감일 HTML
 * @property {string} submitHtml - 제출 상태 HTML
 * @property {string} submitText - 제출 상태 텍스트
 * @property {string} gradeHtml - 성적 HTML
 * @property {string|null} viewUrl - 상세 보기 URL
 * @property {boolean} isCompleted - 완료 여부
 * @property {boolean} [isNeutral] - 중립 상태 여부
 */

/**
 * @typedef {Object} UserContext
 * @property {string} userId - 사용자 ID
 */

/**
 * @typedef {Object} CacheEntry
 * @property {number} timestamp - 캐시 생성 시간
 * @property {Object} data - 캐시된 데이터
 */

/**
 * @typedef {Object} CourseData
 * @property {string} courseId - 강좌 ID
 * @property {string} courseName - 강좌명
 * @property {AttendanceItem[]} items - 출석 항목 배열
 * @property {Assignment[]} assigns - 과제/퀴즈 배열
 * @property {Activity[]} activities - 활동 배열
 * @property {string[]} warnings - 경고 메시지 배열
 * @property {boolean} sessionExpired - 세션 만료 여부
 */

/**
 * @typedef {Object} AllCourseData
 * @property {AttendanceItem[]} allItems - 전체 출석 항목
 * @property {Assignment[]} allAssigns - 전체 과제/퀴즈
 * @property {Activity[]} allActivities - 전체 활동
 * @property {Object[]} allCourseNames - 전체 강좌명 배열
 * @property {string[]} warnings - 경고 메시지 배열
 * @property {boolean} sessionExpired - 세션 만료 여부
 */

module.exports = {};
