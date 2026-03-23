# 호서 LMS+

## 설치방법
1. [릴리즈](https://github.com/dohwi/hoseo-lms-plus/releases)에서 최신 버전 zip 파일을 다운로드합니다.
2. 다운로드한 zip 파일을 압축 해제합니다.
3. 크롬 확장프로그램 페이지로 이동합니다. (`chrome://extensions`)
4. 개발자 모드를 켭니다.
5. 압축 해제한 폴더를 크롬에 드래그 & 드랍합니다.

## 기능
- [X] 주차별 온라인 출석 확인
- [X] 전체 주차 미수강 & 미제출 항목 표시
- [X] 마감 5일 이내 임박항목 빨간 테두리로 강조
- [X] 강좌별 부분 로딩 실패 안내 및 캐시 fallback

## 개발
- 의존성 설치: `npm install`
- 린트: `npm run lint`
- 테스트: `npm test`
- 빌드: `npm run build`

## 개선 사항
- 원본 LMS 메인 영역을 덮어쓰지 않고 별도 마운트 컨테이너를 사용합니다.
- 캐시는 사용자/강좌 조합별로 분리되며 6시간 동안 유지됩니다.
- LMS HTML은 허용 태그/속성만 통과시키는 방식으로 정리한 뒤 렌더링합니다.
- 파서, UI, 공용 유틸을 분리해 유지보수성과 테스트 가능성을 높였습니다.

## 유의사항
- 본 프로그램 사용에 따른 모든 책임은 사용자 본인에게 있습니다.
- 안정성을 위해 `https://learn.hoseo.ac.kr/` 메인 페이지에서만 작동하며, 좌측 사이드바에 호서 LMS+ 탭을 누르면 대시보드가 표시됩니다.

## 이미지
![image1](https://github.com/dohwi/hoseo-lms-plus/blob/main/assets/1.png?raw=true)
![image2](https://github.com/dohwi/hoseo-lms-plus/blob/main/assets/2.png?raw=true)
