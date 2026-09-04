# 개인 기록 (Personal Journal)

Threads 스타일 개인용 기록 웹앱. 텍스트/사진 기록과 자기 답글을 남기고,
데이터는 본인 Google Drive에 저장됩니다.

## 배포 전 해야 할 일

1. **config.js에 클라이언트 ID 입력**
   `config.js` 파일을 열어 `CLIENT_ID` 값을 본인의 OAuth 클라이언트 ID로 교체하세요.
   (기존 다른 앱과 같은 클라이언트 ID를 쓰는 경우, 그 값을 그대로 사용)

2. **Google Cloud Console에서 이 앱의 도메인 등록**
   해당 클라이언트 ID의 "승인된 JavaScript 원본"에 이 앱을 올릴 주소
   (예: `https://아이디.github.io`)를 추가해야 로그인이 동작합니다.

3. **GitHub Pages로 배포**
   이 폴더 전체를 GitHub 저장소에 올리고 GitHub Pages를 활성화하면
   `https://아이디.github.io/저장소이름/` 주소로 접속할 수 있습니다.
   (저장소를 `아이디.github.io` 이름으로 만들면 경로 없이 루트 도메인으로 바로 접속 가능)

## 데이터 저장 구조

Drive에 `personal-journal-data` 폴더가 자동으로 만들어지고, 그 안에:
- `journal.json` — 모든 텍스트 기록과 답글
- 업로드한 사진 파일들 (원본 그대로)

이 저장됩니다. 폴더/파일 이름은 `config.js`에서 바꿀 수 있습니다.

## 권한 범위

`drive.file` 스코프를 사용합니다 — 이 앱이 직접 만든 파일에만 접근 가능한
좁은 권한이라, Google의 별도 보안 심사 없이 테스트 사용자로 등록한
본인 계정으로 바로 사용할 수 있습니다.

## 파일 구성

- `index.html` — 화면 구조
- `style.css` — 디자인 (프로토타입과 동일한 톤)
- `config.js` — 클라이언트 ID 등 설정값
- `drive.js` — Drive API 호출 로직
- `app.js` — 화면 렌더링, 작성/답글 로직
