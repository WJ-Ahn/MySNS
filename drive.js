// Drive API v3를 fetch로 직접 호출하는 얇은 래퍼.
// accessToken은 app.js의 로그인 흐름에서 전달받음.
//
// 변경 사항: 모든 fetch 응답에 대해 res.ok를 확인해서, 실패 시(토큰 만료,
// 네트워크 오류, 권한 문제 등) 조용히 넘어가지 않고 에러를 던지도록 했음.
// 이렇게 해야 app.js가 저장/불러오기 실패를 감지해서 연결 상태 아이콘을
// "끊김"으로 바꿀 수 있음.

const DriveClient = (() => {
  let accessToken = null;
  let folderId = null;

  function setToken(token) {
    accessToken = token;
  }

  function authHeaders(extra = {}) {
    return { Authorization: `Bearer ${accessToken}`, ...extra };
  }

  // 1) 사용자가 config.js에 지정한 폴더 ID를 그대로 사용
  async function ensureFolder() {
    if (!CONFIG.FOLDER_ID || CONFIG.FOLDER_ID.includes("여기에")) {
      throw new Error("config.js에 FOLDER_ID를 먼저 설정해주세요.");
    }
    folderId = CONFIG.FOLDER_ID;
    return folderId;
  }

  // 2) journal.json 파일 id 찾기 (없으면 null, 요청 자체가 실패하면 에러를 던짐)
  async function findJournalFileId() {
    const parent = await ensureFolder();
    const q = encodeURIComponent(
      `name='${CONFIG.JOURNAL_FILENAME}' and '${parent}' in parents and trashed=false`
    );
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
      { headers: authHeaders() }
    );
    if (!res.ok) {
      throw new Error(`Drive 파일 검색 실패 (status ${res.status})`);
    }
    const data = await res.json();
    return data.files && data.files.length > 0 ? data.files[0].id : null;
  }

  // 3) journal.json 내용 불러오기 (파일이 없으면 빈 기록, 요청 실패는 에러로 전파)
  async function loadJournal() {
    const fileId = await findJournalFileId();
    if (!fileId) {
      return { entries: [] };
    }
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: authHeaders() }
    );
    if (!res.ok) {
      throw new Error(`Drive 파일 로드 실패 (status ${res.status})`);
    }
    return await res.json();
  }

  // 4) journal.json 저장 (있으면 덮어쓰기, 없으면 새로 생성). 실패 시 에러를 던짐.
  async function saveJournal(journalObj) {
    const parent = await ensureFolder();
    const fileId = await findJournalFileId();
    const content = JSON.stringify(journalObj, null, 2);
    const blob = new Blob([content], { type: "application/json" });

    if (fileId) {
      const res = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        { method: "PATCH", headers: authHeaders(), body: blob }
      );
      if (!res.ok) {
        throw new Error(`Drive 저장 실패 (status ${res.status})`);
      }
      return fileId;
    }

    const metadata = { name: CONFIG.JOURNAL_FILENAME, parents: [parent] };
    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", blob);

    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      { method: "POST", headers: authHeaders(), body: form }
    );
    if (!res.ok) {
      throw new Error(`Drive 파일 생성 실패 (status ${res.status})`);
    }
    const created = await res.json();
    return created.id;
  }

  // 5) 이미지 업로드, Drive 파일 id 반환 (journal.json에는 이 id만 저장). 실패 시 에러를 던짐.
  async function uploadImage(file) {
    const parent = await ensureFolder();
    const metadata = { name: `${Date.now()}-${file.name}`, parents: [parent] };
    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", file);

    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      { method: "POST", headers: authHeaders(), body: form }
    );
    if (!res.ok) {
      throw new Error(`이미지 업로드 실패 (status ${res.status})`);
    }
    const created = await res.json();
    return created.id;
  }

  // 6) 이미지 파일 id로 실제 바이트를 받아 화면에 표시할 objectURL 생성. 실패 시 에러를 던짐.
  async function getImageObjectUrl(fileId) {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: authHeaders() }
    );
    if (!res.ok) {
      throw new Error(`이미지 로드 실패 (status ${res.status})`);
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  return { setToken, loadJournal, saveJournal, uploadImage, getImageObjectUrl };
})();
