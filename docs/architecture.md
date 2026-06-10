# 호서 LMS+ 아키텍처

## 모듈 의존성

```
content.js (진입점)
├── HoseoLmsPlusCore (lib/core.js)
│     공통 유틸, HTML 새니타이징, 캐시, 요청 큐
├── HoseoLmsPlusParsers (lib/parsers.js) → Core
│     LMS HTML 파싱 → Activity/AttendanceItem/Assignment 배열
├── HoseoLmsPlusUi (lib/ui/index.js) ← elements, dates, tooltip, render
│     DOM 빌더, 대시보드 렌더링
├── HoseoLmsPlusDataService (lib/data-service.js) → Core, Parsers
│     요청 조율, 데이터 연계, 매칭 및 보강
├── HoseoLmsPlusDashboardController (lib/dashboard-controller.js) → Core, Ui, DataService
│     상태 관리, 이벤트 핸들링, 렌더 요청
└── HoseoLmsPlusSidebar (lib/sidebar.js) → Core
      사이드바 탭 주입 및 관찰
```

## 로딩 순서 (manifest content_scripts)

```
lib/core.js → lib/parsers.js → lib/ui/elements.js → lib/ui/dates.js
→ lib/ui/tooltip.js → lib/ui/render.js → lib/ui/index.js
→ lib/data-service.js → lib/dashboard-controller.js → lib/sidebar.js → content.js
```

각 `lib/*.js`는 IIFE로 전역(`HoseoLmsPlus{Module}`) + `module.exports` 이중 노출.
ES2022, `sourceType: 'script'` (ESM 아님), 번들러 없음.

### UI 모듈 구조 (v1.4.0+)
- `lib/ui/elements.js` — DOM 빌더 (createElement/SVG/Button/Icon/clearChildren/appendSanitizedHtml)
- `lib/ui/dates.js` — 날짜 유틸 (getActivityDateRange, getDaysUntilDeadline)
- `lib/ui/tooltip.js` — createInfoTooltip (← elements 의존)
- `lib/ui/render.js` — 대시보드/메시지/로딩 렌더링 (← elements, dates, tooltip 의존)
- `lib/ui/index.js` — 집계 후 `HoseoLmsPlusUi` 전역 등록

## 캐시 스키마

```
키 형식: lms_plus_cache:v{CACHE_VERSION}:{userId}:{sortedCourseIds,}
예: lms_plus_cache:v3:101:202,303,404

TTL: 6시간 (CACHE_TTL = 21600000ms)
저장소: chrome.storage.local (비동기) 우선, localStorage (동기) fallback
```

- `promise.then()` 존재하면 Promise API, 없으면 콜백 API 사용
- `pruneExpiredEntries()`가 매 접근 시 만료 항목 정리
- 새로고침 시 해당 키만 삭제 후 재요청

## 매칭 정책

활동(Activity)과 출석/과제/퀴즈 항목을 연결하는 2단계 매칭:

### 1차 — 키 매칭 (`findMatchedByKey`)
`core.buildActivityKey()`로 안정적 식별자 추출. 우선순위:
1. `activityKey` 필드 (파서가 이미 추출한 값)
2. URL query param 식별자 (`cmid` → `coursemodule` → `activity` → `id` 순서)
3. 정규화된 이름 (`nameHtml`/`materialHtml`/`titleHtml`/`nameText`)

### 2차 — 이름 부분 매칭 (`matchesNormalizedText`)
키 매칭 실패 시 보완. `[퀴즈]` 접두사 제거, 괄호/특수문자 정규화 후 부분 일치.

### 미매칭
해당 활동은 `isNeutral=true`로 표시 (상태 확인 불가). 파일/토론/Forum 타입은 기본적으로 `isIgnoredType=true`.

## 셀렉터 외부화

LMS HTML에 의존하는 모든 CSS 셀렉터는 `core.SELECTORS`에 집약되어 있음.
마크업 변동 시 `core.SELECTORS` 우선 수정, 이후 파서 로직 변경.

### 셀렉터 목록

| 키 | 용도 |
|----|------|
| `courseItems` | 강좌 카드 검출 (`.lists .course`, `.course-card[data-id]`, `[data-course-id]`) |
| `dashboardMountId` | 대시보드 마운트 영역 ID (`lms-custom-dashboard`) |
| `mainHosts` | LMS 메인 컨텐츠 영역 (`#region-main`, `#page-content`, `main`) |
| `sidebarContainer` | 사이드바 컨테이너 (`#mCSB_1_container`, `#nav-drawer`, `.drawer-left`, `aside[role="navigation"]`) |
| `sidebarMenu` | 사이드바 메뉴 (`:scope > ul`) |
| `userContext` | 사용자 컨텍스트 검출 (`[data-userid]`, `.usermenu [data-userid]`) |

## 안전성 가이드

### HTML 새니타이징
- 허용 요소: `A`, `B`, `BR`, `EM`, `I`, `IMG`, `SMALL`, `SPAN`, `STRONG`
- 차단: `SCRIPT`, `STYLE`, `IFRAME`, `on*` 속성, `javascript:` URL
- `A` 요소는 `target="_blank"`, `rel="noopener noreferrer"` 자동 추가
- `DIV`, `P` 등의 블록 요소는 텍스트만 추출 (`TEXT_ONLY_TAGS`)

### 요청 안전성
- `AbortController` 기반 요청 큐 (기본 동시성 6)
- `sessionExpired` 감지 시 렌더 중단, 로그인 재인증 안내
- LMS redirect (`/login/` 패턴) 감지 시 세션 만료로 처리

## 빌드 산출물

```
dist/
├── chrome/
│   ├── manifest.json  (browser_specific_settings 제거)
│   ├── content.js
│   ├── styles.css
│   ├── lib/
│   ├── icon*.png
│   └── hoseo-lms-plus-chrome-v{version}.zip
└── firefox/
    ├── manifest.json  (browser_specific_settings 포함)
    ├── content.js
    ├── styles.css
    ├── lib/
    ├── icon*.png
    └── hoseo-lms-plus-firefox-v{version}.zip
```

`scripts/build.js`가 파일 복사 + manifest 변환 + zip 생성. 트랜스파일 없음.
dist는 `.gitignore`에 포함.
