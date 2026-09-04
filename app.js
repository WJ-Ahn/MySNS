let journal = { entries: [] };
let expanded = {};
let composerImageFile = null;
let composerImagePreviewUrl = null;
const imageUrlCache = {}; // driveFileId -> objectURL

const feedEl = document.getElementById("feed");
const headerDateEl = document.getElementById("header-date");
const composerTextEl = document.getElementById("composer-text");
const composerPostBtn = document.getElementById("composer-post-btn");
const composerImageBtn = document.getElementById("composer-image-btn");
const composerFileInput = document.getElementById("composer-file-input");
const composerImagePreview = document.getElementById("composer-image-preview");
const composerImageTag = document.getElementById("composer-image-tag");
const composerImageRemove = document.getElementById("composer-image-remove");

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatHeaderDate() {
  return new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" });
}

// ---------- 로그인 ----------
let tokenClient;

function initGis() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: CONFIG.SCOPES,
    callback: async (response) => {
      if (response.error) {
        alert("로그인에 실패했습니다: " + response.error);
        return;
      }
      DriveClient.setToken(response.access_token);
      await startApp();
    },
  });

  const btnContainer = document.getElementById("google-signin-btn");
  const btn = document.createElement("button");
  btn.textContent = "Google로 계속하기";
  btn.className = "post-btn";
  btn.style.padding = "10px 20px";
  btn.onclick = () => tokenClient.requestAccessToken();
  btnContainer.appendChild(btn);
}

async function startApp() {
  document.getElementById("signin-screen").style.display = "none";
  document.getElementById("app-screen").style.display = "flex";
  headerDateEl.textContent = formatHeaderDate();

  journal = await DriveClient.loadJournal();
  if (!journal.entries) journal.entries = [];
  render();
}

// ---------- 렌더링 ----------
async function render() {
  feedEl.innerHTML = "";

  for (const entry of journal.entries) {
    const entryEl = document.createElement("div");
    entryEl.className = "entry";

    if (entry.imageFileId) {
      const img = document.createElement("img");
      img.className = "entry-image";
      entryEl.appendChild(img);
      resolveImage(entry.imageFileId).then((url) => (img.src = url));
    }

    if (entry.text) {
      const p = document.createElement("p");
      p.className = "entry-text";
      p.textContent = entry.text;
      entryEl.appendChild(p);
    }

    const meta = document.createElement("div");
    meta.className = "entry-meta";

    const time = document.createElement("span");
    time.className = "entry-time";
    time.textContent = formatTime(entry.time);
    meta.appendChild(time);

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "reply-toggle-btn" + (entry.replies.length ? " has-replies" : "");
    toggleBtn.textContent = "💬 " + (entry.replies.length > 0 ? entry.replies.length : "답글");
    toggleBtn.onclick = () => {
      expanded[entry.id] = !expanded[entry.id];
      render();
    };
    meta.appendChild(toggleBtn);
    entryEl.appendChild(meta);

    if (expanded[entry.id]) {
      const thread = document.createElement("div");
      thread.className = "thread";

      for (const reply of entry.replies) {
        const row = document.createElement("div");
        row.className = "reply-row";

        const line = document.createElement("div");
        line.className = "reply-line";
        row.appendChild(line);

        const textWrap = document.createElement("div");
        const rp = document.createElement("p");
        rp.className = "reply-text";
        rp.textContent = reply.text;
        const rt = document.createElement("span");
        rt.className = "reply-time";
        rt.textContent = formatTime(reply.time);
        textWrap.appendChild(rp);
        textWrap.appendChild(rt);
        row.appendChild(textWrap);

        thread.appendChild(row);
      }

      const replyComposer = document.createElement("div");
      replyComposer.className = "reply-composer";
      const rline = document.createElement("div");
      rline.className = "reply-line";
      rline.style.alignSelf = "stretch";
      const input = document.createElement("input");
      input.placeholder = "스스로에게 답글 달기";
      const sendBtn = document.createElement("button");
      sendBtn.className = "reply-send-btn";
      sendBtn.textContent = "➤";

      input.oninput = () => {
        sendBtn.classList.toggle("active", input.value.trim().length > 0);
      };
      const submit = () => {
        const text = input.value.trim();
        if (!text) return;
        entry.replies.push({ id: `r${Date.now()}`, text, time: new Date().toISOString() });
        expanded[entry.id] = true;
        DriveClient.saveJournal(journal);
        render();
      };
      input.onkeydown = (e) => { if (e.key === "Enter") submit(); };
      sendBtn.onclick = submit;

      replyComposer.appendChild(rline);
      replyComposer.appendChild(input);
      replyComposer.appendChild(sendBtn);
      thread.appendChild(replyComposer);

      entryEl.appendChild(thread);
    }

    feedEl.appendChild(entryEl);
  }
}

async function resolveImage(fileId) {
  if (imageUrlCache[fileId]) return imageUrlCache[fileId];
  const url = await DriveClient.getImageObjectUrl(fileId);
  imageUrlCache[fileId] = url;
  return url;
}

// ---------- 작성창 ----------
function updatePostButtonState() {
  const hasText = composerTextEl.value.trim().length > 0;
  composerPostBtn.disabled = !hasText && !composerImageFile;
}

composerTextEl.addEventListener("input", updatePostButtonState);

composerImageBtn.addEventListener("click", () => composerFileInput.click());

composerFileInput.addEventListener("change", () => {
  const file = composerFileInput.files[0];
  if (!file) return;
  composerImageFile = file;
  composerImagePreviewUrl = URL.createObjectURL(file);
  composerImageTag.src = composerImagePreviewUrl;
  composerImagePreview.style.display = "block";
  updatePostButtonState();
});

composerImageRemove.addEventListener("click", () => {
  composerImageFile = null;
  composerImagePreview.style.display = "none";
  composerFileInput.value = "";
  updatePostButtonState();
});

composerPostBtn.addEventListener("click", async () => {
  const text = composerTextEl.value.trim();
  if (!text && !composerImageFile) return;

  composerPostBtn.disabled = true;
  composerPostBtn.textContent = "저장 중...";

  let imageFileId = null;
  if (composerImageFile) {
    imageFileId = await DriveClient.uploadImage(composerImageFile);
  }

  const newEntry = {
    id: `e${Date.now()}`,
    text,
    imageFileId,
    time: new Date().toISOString(),
    replies: [],
  };
  journal.entries.unshift(newEntry);
  await DriveClient.saveJournal(journal);

  composerTextEl.value = "";
  composerImageFile = null;
  composerImagePreview.style.display = "none";
  composerFileInput.value = "";
  composerPostBtn.textContent = "남기기";
  updatePostButtonState();

  render();
});

// ---------- 시작 ----------
window.addEventListener("load", () => {
  // GIS 스크립트가 비동기로 로드되므로 약간의 지연 후 초기화
  const check = setInterval(() => {
    if (window.google && google.accounts) {
      clearInterval(check);
      initGis();
    }
  }, 100);
});
