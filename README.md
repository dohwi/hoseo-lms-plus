# 호서 LMS+

## 설치방법

### Chrome 웹스토어 설치
- [Chrome 웹 스토어](https://chromewebstore.google.com/detail/%ED%98%B8%EC%84%9C-lms+/elhbledijdmffjdaplamdkejdgpiddpd?hl=ko)에서 설치합니다.

### Firefox addon 설치
- [Firefox addons](https://addons.mozilla.org/ko/firefox/addon/%ED%98%B8%EC%84%9C-lms/)에서 설치합니다.

### 수동 설치
1. [릴리즈](https://github.com/dohwi/hoseo-lms-plus/releases)에서 최신 버전 zip 파일을 다운로드합니다.
2. 다운로드한 zip 파일을 압축 해제합니다.
3. 크롬 확장프로그램 페이지로 이동합니다. (`chrome://extensions`)
4. 개발자 모드를 켭니다.
5. 압축 해제한 폴더를 크롬에 드래그 & 드랍합니다.

## 기능
- [X] 주차별 온라인 출석 확인
- [X] 전체 주차 미수강 & 미제출 항목 표시
- [X] 마감 7일 이내 임박항목 빨간 테두리로 강조
- [X] 강좌별 부분 로딩 실패 안내 및 캐시 fallback
- [X] 강좌별 공지사항 게시판 바로가기

## 개발
- 의존성 설치: `npm install`
- 린트: `npm run lint`
- Firefox 사전 검사: `npm run lint:firefox`
- 테스트: `npm test`
- 빌드: `npm run build`
- 전체 배포본 빌드: `npm run build:all`
- 배포 ZIP 검증: `npm run verify:zip`
- 런타임 의존성 감사: `npm audit --omit=dev --audit-level=high`

## 개선 사항
- 원본 LMS 메인 영역을 덮어쓰지 않고 별도 마운트 컨테이너를 사용합니다.
- 캐시는 사용자/강좌 조합별로 분리되며 6시간 동안 유지되고, 사용자 식별 실패·스키마 손상·4 MiB 초과 시 사용하지 않습니다.
- LMS HTML은 허용 태그/속성만 통과시키고 동일 LMS 출처의 링크와 이미지만 유지한 뒤 렌더링합니다.
- LMS 응답은 2 MiB로 제한하며 요청은 최대 15초 후 중단되고, 한 번의 로딩에서 동일 URL은 재사용합니다.
- 배포 ZIP은 고정된 파일 목록과 타임스탬프로 재현 가능하게 생성하며 내용·CRC·압축 해제를 자동 검증합니다.
- 파서, UI, 공용 유틸을 분리해 유지보수성과 테스트 가능성을 높였습니다.

## 개인정보 및 유의사항
- LMS 조회 결과는 브라우저 확장 로컬 저장소에 최대 6시간 캐시되며 외부 서버로 전송하지 않습니다.
- 자세한 내용은 [개인정보처리방침](PRIVACY_POLICY.md)을 확인해주세요.
- 본 프로그램 사용에 따른 모든 책임은 사용자 본인에게 있습니다.
- 안정성을 위해 `https://learn.hoseo.ac.kr/` 메인 페이지에서만 작동하며, 좌측 사이드바에 호서 LMS+ 탭을 누르면 대시보드가 표시됩니다.

## 이미지
![image1](https://github.com/dohwi/hoseo-lms-plus/blob/main/assets/1.png?raw=true)
![image2](https://github.com/dohwi/hoseo-lms-plus/blob/main/assets/2.png?raw=true)
