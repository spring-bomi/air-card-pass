[ 에어 카드 패스 (Air Card Pass) 프로젝트 ]

반영된 기획 요소를 포함한 전체 소스코드 아카이브입니다.
- 외부 전광판(디스플레이) 타이머 연동 및 폭탄 폭발 패배 로직 반영
- Render / Cloud 환경 배포용 동적 PORT 바인딩 구성 완료
- 5초 후 블라인드 처리 및 3초 전 극적인 서서히 나타나기 시각 효과 포함

■ 프로젝트 폴더 구조
air-card-pass/
  ├── package.json
  ├── server.js
  ├── .gitignore
  └── public/
        ├── index.html     (플레이어 화면)
        └── display.html   (메인 전광판 화면)

■ 로컬 실행 방법
1. 본 압축 파일을 해제합니다.
2. 터미널(명령 프롬프트)에서 해당 폴더로 이동합니다.
3. `npm install` 명령어로 라이브러리를 설치합니다.
4. `npm start` 또는 `node server.js`로 서버를 실행합니다.
5. 디스플레이 화면: http://localhost:3000/display.html
   플레이어 화면: http://localhost:3000
