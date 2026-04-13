# 호서 LMS+

Chrome/Firefox 확장 프로그램. `https://learn.hoseo.ac.kr/`에서만 동작하며 LMS 대시보드를 개선.

## 명령어

```bash
npm run lint          # ESLint 검사
npm test              # node --test (jsdom 사용)
npm run lint:firefox  # Firefox 빌드 후 web-ext lint (빌드 선행 필요)
npm run build         # Chrome 빌드 (dist/chrome/ + zip)
npm run build:firefox # Firefox 빌드
npm run build:all     # Chrome + Firefox 동시 빌드
```

커밋 전 확인 순서: `lint → test → build`

## 아키텍처

번들러/트랜스파일러 없음. 소스 JS가 확장 프로그램으로 그대로 로드됨.

**로딩 순서** (manifest.json content_scripts 순서):
`lib/core.js` → `lib/parsers.js` → `lib/ui.js` → `lib/data-service.js` → `lib/dashboard-controller.js` → `lib/sidebar.js` → `content.js`

- 각 `lib/*.js`는 IIFE로 전역 변수(`HoseoLmsPlusCore` 등)에 등록 + `module.exports` 지원 (테스트용)
- `lib/types.js`: JSDoc `@typedef`만 정의, 런타임 코드 없음
- `content.js`: 진입점. 메인 페이지(`/` 또는 `/index.php`)에서만 실행
- `scripts/build.js`: 파일 복사 + manifest 수정 + zip 생성. 트랜스파일 없음

## 코드 규칙

- ES2022, `sourceType: 'script'` (ESM 아님)
- `no-var`, `prefer-const`, `eqeqeq`(항상 `===`), `no-undef` 엄격
- `_` 접두사 파라미터는 unused 허용
- `chrome` 전역 읽기 전용 허용 (확장 프로그램 API)
- 브라우저/Node 전역 모두 접근 가능 (ESLint 설정)

## 테스트

- `node:test` + `node:assert/strict` + jsdom
- 테스트 파일: `test/*.test.js`
- 테스트 픽스처: `test/fixtures/` (HTML 샘플)
- lib 모듈을 `require()`로 로드. JSDOM 인스턴스에서 `global.Node` 설정 필요:
  ```js
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  global.Node = dom.window.Node;
  ```

## CI

`.github/workflows/ci.yml`: lint → test → lint:firefox (Node 22)

## 빌드 산출물

`dist/` 디렉토리에 생성. `.gitignore`에 포함됨.
- `dist/chrome/`, `dist/firefox/` 각각 독립 복사본
- Firefox는 `browser_specific_settings.gecko` 포함, Chrome은 제외
- zip 파일: `dist/{target}/hoseo-lms-plus-{target}-v{version}.zip`
