// 여기에 Google Cloud Console에서 발급받은(또는 기존 두 앱과 공유하는)
// OAuth 클라이언트 ID를 붙여넣으세요.
// 예: "123456789-abcdefg.apps.googleusercontent.com"
const CONFIG = {
  CLIENT_ID: "여기에_클라이언트_ID_붙여넣기.apps.googleusercontent.com",

  // drive.file: 이 앱이 만든 파일에만 접근하는 좁은 권한.
  // Google 보안 심사 없이 테스트 사용자로 바로 사용 가능.
  SCOPES: "https://www.googleapis.com/auth/drive.file",

  // Drive에 만들 폴더/파일 이름 (원하면 바꿔도 됨)
  FOLDER_NAME: "personal-journal-data",
  JOURNAL_FILENAME: "journal.json",
};
