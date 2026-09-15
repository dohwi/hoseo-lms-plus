# 호서 LMS+

> 호서대학교 LMS의 온라인 출석, 과제, 퀴즈, 공지사항을 주차별로 한눈에 확인하는 비공식 브라우저 확장 프로그램입니다.

[![Latest Release](https://img.shields.io/github/v/release/dohwi/hoseo-lms-plus?display_name=tag&style=flat-square)](https://github.com/dohwi/hoseo-lms-plus/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/dohwi/hoseo-lms-plus/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/dohwi/hoseo-lms-plus/actions/workflows/ci.yml)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/%ED%98%B8%EC%84%9C-lms+/elhbledijdmffjdaplamdkejdgpiddpd?hl=ko)
[![Firefox Add-ons](https://img.shields.io/badge/Firefox-Add--ons-FF7139?style=flat-square&logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org/ko/firefox/addon/%ED%98%B8%EC%84%9C-lms/)

호서 LMS+는 기존 LMS 화면을 변경하거나 외부 서버로 정보를 전송하지 않습니다. 로그인된 LMS 세션을 이용해 필요한 페이지를 같은 출처에서 조회하고, 결과를 브라우저 확장 로컬 저장소에 임시 캐시합니다.

## 주요 기능

- **주차별 통합 대시보드** — 온라인 강의, 과제, 퀴즈, 참고 자료를 강좌별로 정리합니다.
- **완료 상태 확인** — 출석 시간, 제출 여부, 퀴즈 응시 상태를 LMS 정보에 따라 판정합니다.
- **미완료 항목 모아보기** — 전체 주차의 미수강·미제출 항목을 별도 표에서 확인할 수 있습니다.
- **마감 임박 강조** — 마감까지 7일 이하인 미완료 항목을 붉은 테두리와 배지로 표시합니다.
- **강좌 공지사항 통합** — 공지 작성일을 기준으로 해당 주차에 배치하고, 매칭되지 않으면 `기타`에 표시합니다.
- **주차 요약** — 현재 주차의 전체 자료, 완료, 미완료, 공지 개수를 제공합니다.
- **부분 실패 안내** — 일부 강좌를 불러오지 못해도 나머지 강좌는 계속 표시합니다.
- **키보드 및 스크린 리더 지원** — 주차 이동, 안내 모달, 포커스 제어와 행별 강좌 문맥을 제공합니다.

## 화면 상태 기준

| 표시 | 의미 |
| --- | --- |
| 완료 | 학습을 완료했거나 과제·퀴즈를 제출한 항목 |
| 마감 임박 | 마감까지 7일 이하로 남은 미완료 항목 |
| 시작 전 | 학습 또는 제출 시작일이 아직 지나지 않은 항목 |
| 미완료 | 시작 기간이 지났고 아직 완료하지 않은 항목 |
| 공지사항 | 작성일 기준 해당 주차에 등록된 강좌 공지 |
| 참고 | 파일·링크처럼 완료 여부를 판정하지 않는 자료 |

대시보드 우측 상단의 정보 버튼에서 실제 행 디자인과 함께 상세 판정 기준을 확인할 수 있습니다.

## 설치

### Chrome

[Chrome 웹 스토어에서 호서 LMS+ 설치](https://chromewebstore.google.com/detail/%ED%98%B8%EC%84%9C-lms+/elhbledijdmffjdaplamdkejdgpiddpd?hl=ko)

### Firefox

[Firefox Add-ons에서 호서 LMS+ 설치](https://addons.mozilla.org/ko/firefox/addon/%ED%98%B8%EC%84%9C-lms/)

### 수동 설치

1. [GitHub Releases](https://github.com/dohwi/hoseo-lms-plus/releases/latest)에서 브라우저에 맞는 ZIP을 내려받습니다.
2. Chrome은 ZIP을 압축 해제한 뒤 `chrome://extensions`를 엽니다.
3. **개발자 모드**를 켜고 **압축해제된 확장 프로그램을 로드합니다**를 선택합니다.
4. 압축을 해제한 폴더를 지정합니다.

> Firefox 정식 사용은 AMO 설치본을 권장합니다. 수동 ZIP은 개발·검증 용도입니다.

## 사용 방법

1. `https://learn.hoseo.ac.kr/`에 로그인합니다.
2. LMS 메인 페이지의 좌측 메뉴에서 **호서 LMS+**를 선택합니다.
3. 이전·다음 버튼 또는 키보드 방향키로 주차를 이동합니다.
4. 최신 상태가 필요하면 우측 상단 새로고침 버튼을 누릅니다.

캐시는 기본 6시간 유지됩니다. 새로고침 버튼은 현재 사용자·강좌 조합의 캐시를 제거하고 LMS에서 다시 조회합니다.

## 보안 및 개인정보 보호

- 네트워크 요청은 `https://learn.hoseo.ac.kr/` 동일 출처로 제한됩니다.
- 분석 도구, 광고 SDK, 추적 서버 및 별도 백엔드를 사용하지 않습니다.
- LMS에서 읽은 데이터는 개발자나 제3자에게 전송하지 않습니다.
- HTML은 허용된 태그와 속성만 남기며 외부 링크, 외부 이미지, 스크립트성 URL을 차단합니다.
- 사용자 식별에 실패하면 다른 사용자와의 캐시 충돌을 막기 위해 캐시를 사용하지 않습니다.
- 캐시는 6시간 후 만료되며 손상됐거나 4 MiB를 초과하면 자동으로 무시합니다.
- 개별 LMS 응답은 2 MiB로 제한되고 요청은 15초 후 중단됩니다.

자세한 내용은 [개인정보처리방침](PRIVACY_POLICY.md)을 확인하세요.

## 안정성 및 성능

- 최대 6개의 네트워크 요청만 동시에 실행합니다.
- 페이지를 이탈하면 진행 중이거나 대기 중인 요청을 취소합니다.
- 한 번의 로딩 과정에서 같은 URL의 요청 결과를 재사용합니다.
- 모든 미완료 과제와 퀴즈의 상세 상태를 확인하며 임의의 개수 제한을 두지 않습니다.
- 비정상적으로 큰 공지 게시판의 후보 수와 입력 길이를 제한합니다.
- 일부 강좌 요청이 실패해도 정상적으로 수집된 결과는 계속 표시합니다.

## 개발 및 검증

### 요구 환경

- Node.js 22 이상
- npm

### 명령어

```bash
npm ci
npm run lint
npm test
npm run build:all
npm run verify:zip
npm run lint:firefox
npm audit --omit=dev --audit-level=high
```

| 명령 | 설명 |
| --- | --- |
| `npm run lint` | 전체 JavaScript ESLint 검사 |
| `npm test` | 파서, 캐시, 네트워크, UI, 접근성 및 빌드 테스트 |
| `npm run build:chrome` | Chrome ZIP 생성 |
| `npm run build:firefox` | Firefox ZIP 생성 |
| `npm run build:all` | Chrome·Firefox 배포본 동시 생성 |
| `npm run verify:zip` | ZIP allowlist, 경로, 압축 데이터, 크기 및 CRC 검증 |
| `npm run lint:firefox` | Firefox 패키지 생성 후 `web-ext lint` 실행 |

## 재현 가능한 배포

배포 ZIP은 Node 내장 `zlib`으로 생성됩니다.

- 파일 순서 고정
- ZIP 타임스탬프 정규화
- 개발·민감 파일 allowlist 차단
- Local Header 및 Central Directory 검증
- 실제 압축 해제, 원본 크기 및 CRC-32 검증
- 동일 소스에서 동일한 SHA-256 체크섬 생성

GitHub Release는 일반 `main` 푸시가 아니라 명시적인 수동 CI 실행에서만 생성됩니다.

## 프로젝트 구조

```text
content.js                  확장 프로그램 진입점
lib/core.js                 보안 정제, 캐시, 요청 큐, 공용 유틸리티
lib/parsers.js              LMS HTML 파서
lib/data-service.js         네트워크 요청 및 활동 상태 통합
lib/dashboard-controller.js 대시보드 상태와 수명주기 관리
lib/sidebar.js              LMS 사이드바 메뉴 연결
lib/ui/                     DOM 생성, 날짜, 모달, 렌더링
scripts/build.js            Chrome·Firefox 결정적 ZIP 빌드
scripts/zip-policy.js       배포 ZIP 정책 및 무결성 검증
test/                       단위·통합·빌드 회귀 테스트
```

더 자세한 설계는 [아키텍처 문서](docs/architecture.md), 버전별 변경사항은 [CHANGELOG](CHANGELOG.md)를 참고하세요.

## 유의사항

- 호서 LMS+는 호서대학교의 공식 서비스가 아닙니다.
- LMS 페이지 구조가 변경되면 일부 정보가 일시적으로 표시되지 않을 수 있습니다.
- 대시보드 정보는 편의를 위한 보조 자료이며, 제출·출석 여부는 필요한 경우 LMS 원본 화면에서 최종 확인하세요.
- 프로그램 사용에 따른 책임은 사용자에게 있습니다.

## 문의

버그 제보 및 기능 제안은 [GitHub Issues](https://github.com/dohwi/hoseo-lms-plus/issues)를 이용해주세요.

기타 문의: [me@dohwi.com](mailto:me@dohwi.com)
