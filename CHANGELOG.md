# 변경 이력

## [Unreleased]

### 변경
- CI에 push to main 시 자동 태그 생성 및 GitHub Release 배포 추가

---

## [1.4.0] - 2026-06-11

### 리팩터링
- `lib/ui.js`를 5개 모듈로 분할 (elements, dates, tooltip, render, index)
- `manifest.json`의 content_scripts 로딩 순서 반영
- 테스트에서 서브 모듈을 명시적 로드 후 집계 모듈 사용

---

## [1.3.0] - 2026-06-11

### 변경
- `core.buildActivityKey`가 빈 문자열 대신 `null` 반환 — 매칭 로직 타입 안전성 강화
- `core.dedupActivities`가 null 키 항목을 필터링하도록 개선
- `core.SELECTORS`에 파서용 셀렉터 fallback 체인 추가 (attendanceTable, courseSection, activityTable, quizTable)
- `core.queryWithFallback()` 유틸 추가 — 배열 셀렉터 순회하며 첫 매치 사용
- `IRREGULAR_COURSE_TYPES`를 `core.SELECTORS.irregularCourseTypes`로 이전
- `lib/parsers.js`의 모든 셀렉터를 `queryWithFallback`으로 교체
- `lib/data-service.js`의 `findMatchedByKey`에 null 키 가드 추가

---

## [1.2.9] - 2026-06-11

### 추가
- `docs/architecture.md` 신규 (모듈 의존성, 캐시 스키마, 매칭 정책, 셀렉터 가이드)
- `lib/types.js`의 `@typedef`에 의도 및 fallback 설명 보강
- `lib/core.js` 핵심 함수에 의도 주석 추가
- `lib/data-service.js` 상단에 매칭 정책 2단계 명세

---

## [1.2.8] - 2026-06-11

### 리팩터링
- 활동/과제/출석 항목 매칭 키를 `core.buildActivityKey`로 통합
- `data-service`의 `isSameActivity` 제거, 매칭 키 계산 로직 중복 해소

---

## [1.2.7] - 2026-06-11

### 수정
- SPA 네비게이션 시 대시보드/사이드바가 잔존하던 문제 수정
- `popstate` 및 `<title>` 변경 감지로 LMS 내부 화면 전환 대응
- 대시보드 정리 시 기존 LMS 메인 컨텐츠를 복원하도록 변경

---

## [1.2.6] - 2026-06-11

### 변경
- 대시보드 버전 표기를 manifest.json과 자동 연동하도록 변경
- lib/ui.js의 하드코딩 버전 문자열(`v1.2.5`) 제거

---

## [1.2.2] - 2026-03-27

### 추가
- Firefox 배포용 패키지 빌드 및 사전 검사 스크립트 추가
- 상태 표기 기준 안내 툴팁과 하단 안내 문구 추가

### 변경
- Chrome/Firefox 공통 확장 API 사용 방식으로 정리
- 퀴즈 연속 행 파싱과 주차 매칭 정확도 개선
- 미완료 항목 강조 기준을 7일 이내로 조정하고 시작 전 항목은 노란색으로 표시
- 설치 안내를 Chrome 웹스토어 설치와 수동 설치로 구분

---

## [1.2.1] - 2026-03-24

### 추가
- 헤더에 버전 뱃지 (v1.2.1) 추가
- 마감 5일 이하 항목 자동 감지 및 강조 표시 기능
  - 붉은 테두리로 시각적 강조
  - 마감일 텍스트 빨간색 표시
  - 미수강 섹션: 해당 주차 ~ 이수여부까지 붉은 테두리
  - 통합본: 유형 ~ 이수여부까지 붉은 테두리

### 변경
- 대시보드 헤더를 3단 레이아웃으로 개선 (타이틀 - 주차 선택기 - 액션 버튼)
- 주차 선택기를 헤더 중앙으로 이동
- 주차 기간 정보를 "전체 학습 자료" 섹션 위로 이동
- 새로고침 버튼에 🔄 이모지 추가
- 미수강 섹션 스타일을 전체 학습 자료 섹션과 통일

### 제거
- "LMS 홈으로 복귀" 버튼 제거
- 기존 독립 주차 카드 섹션 제거
- 미수강 섹션의 불필요한 흰 배경 제거

### 최적화
- CSS 스타일 정리 및 중복 제거
- 헤더 레이아웃 최적화

---

## [1.2.0] - 이전 버전
(이전 버전 내역은 Git 히스토리 참조)
