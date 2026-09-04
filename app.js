let journal = { entries: [] };
let expanded = {};
let editingEntryId = null;
let editingReplyKey = null; // `${entryId}:${replyId}`
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

const ICONS = {
  image: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`,
  reply: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  send: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg>`,
  close: `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`,
  check: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
};

function iconBtn(name, className, title) {
  const btn = document.createElement("button");
  btn.className = className;
  btn.title = title;
  btn.innerHTML = ICONS[name];
  return btn;
}

composerImageBtn.innerHTML = ICONS.image;
composerImageRemove.innerHTML = ICONS.close;

// 날짜+시간을 함께 표시 (기록이 여러 날에 걸쳐 쌓이므로 매번 날짜를 표시)
function formatDateTime(iso) {
  const d = new Date(iso);
  const datePart = d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
  const timePart = d.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${datePart} · ${timePart}`;
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
  headerDateEl.textContent = "개인 기록";

  journal = await DriveClient.loadJournal();
  if (!journal.entries) journal.entries = [];
  render();
}

async function persist() {
  await DriveClient.saveJournal(journal);
}

// ---------- 렌더링 ----------
async function render() {
  feedEl.innerHTML = "";

  for (const entry of journal.entries) {
    const entryEl = document.createElement("div");
    entryEl.className = "entry";

    if (editingEntryId === entry.id) {
      entryEl.appendChild(buildEditBox(entry.text, async (newText) => {
        entry.text = newText;
        editingEntryId = null;
        await persist();
        render();
      }, () => { editingEntryId = null; render(); }));
      feedEl.appendChild(entryEl);
      continue;
    }

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
    time.textContent = formatDateTime(entry.time);
    meta.appendChild(time);

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "reply-toggle-btn" + (entry.replies.length ? " has-replies" : "");
    toggleBtn.innerHTML = ICONS.reply + `<span>${entry.replies.length > 0 ? entry.replies.length : "답글"}</span>`;
    toggleBtn.onclick = () => {
      expanded[entry.id] = !expanded[entry.id];
      render();
    };
    meta.appendChild(toggleBtn);

    const spacer = document.createElement("span");
    spacer.style.flex = "1";
    meta.appendChild(spacer);

    const editBtn = iconBtn("edit", "meta-icon-btn", "수정");
    editBtn.onclick = () => { editingEntryId = entry.id; render(); };
    meta.appendChild(editBtn);

    const deleteBtn = iconBtn("trash", "meta-icon-btn", "삭제");
    deleteBtn.onclick = async () => {
      if (!confirm("이 기록을 삭제할까요?")) return;
      journal.entries = journal.entries.filter((e) => e.id !== entry.id);
      await persist();
      render();
    };
    meta.appendChild(deleteBtn);

    entryEl.appendChild(meta);

    if (expanded[entry.id]) {
      const thread = document.createElement("div");
      thread.className = "thread";

      for (const reply of entry.replies) {
        const replyKey = `${entry.id}:${reply.id}`;
        const row = document.createElement("div");
        row.className = "reply-row";

        const line = document.createElement("div");
        line.className = "reply-line";
        row.appendChild(line);

        if (editingReplyKey === replyKey) {
          const editWrap = document.createElement("div");
          editWrap.style.flex = "1";
          editWrap.appendChild(buildEditBox(reply.text, async (newText) => {
            reply.text = newText;
            editingReplyKey = null;
            await persist();
            render();
          }, () => { editingReplyKey = null; render(); }));
          row.appendChild(editWrap);
        } else {
          const textWrap = document.createElement("div");
          textWrap.style.flex = "1";
          const rp = document.createElement("p");
          rp.className = "reply-text";
          rp.textContent = reply.text;
          const metaRow = document.createElement("div");
          metaRow.className = "reply-meta";
          const rt = document.createElement("span");
          rt.className = "reply-time";
          rt.textContent = formatDateTime(reply.time);
          metaRow.appendChild(rt);

          const rSpacer = document.createElement("span");
          rSpacer.style.flex = "1";
          metaRow.appendChild(rSpacer);

          const rEditBtn = iconBtn("edit", "meta-icon-btn small", "수정");
          rEditBtn.onclick = () => { editingReplyKey = replyKey; render(); };
          metaRow.appendChild(rEditBtn);

          const rDeleteBtn = iconBtn("trash", "meta-icon-btn small", "삭제");
          rDeleteBtn.onclick = async () => {
            if (!confirm("이 답글을 삭제할까요?")) return;
            entry.replies = entry.replies.filter((r) => r.id !== reply.id);
            await persist();
            render();
          };
          metaRow.appendChild(rDeleteBtn);

          textWrap.appendChild(rp);
          textWrap.appendChild(metaRow);
          row.appendChild(textWrap);
        }

        thread.appendChild(row);
      }

      const replyComposer = document.createElement("div");
      replyComposer.className = "reply-composer";
      const rline = document.createElement("div");
      rline.className = "reply-line";
      rline.style.alignSelf = "stretch";
      const input = document.createElement("textarea");
      input.rows = 1;
      input.placeholder = "스스로에게 답글 달기 (줄바꿈은 엔터)";
      const sendBtn = document.createElement("button");
      sendBtn.className = "reply-send-btn";
      sendBtn.innerHTML = ICONS.send;

      input.oninput = () => {
        sendBtn.classList.toggle("active", input.value.trim().length > 0);
      };
      const submit = async () => {
        const text = input.value.trim();
        if (!text) return;
        entry.replies.push({ id: `r${Date.now()}`, text, time: new Date().toISOString() });
        expanded[entry.id] = true;
        await persist();
        render();
      };
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

// 수정 모드 공용 UI: textarea + 저장/취소 아이콘 버튼
function buildEditBox(initialText, onSave, onCancel) {
  const wrap = document.createElement("div");
  wrap.className = "edit-box";

  const textarea = document.createElement("textarea");
  textarea.className = "edit-textarea";
  textarea.value = initialText;
  textarea.rows = 2;

  const actions = document.createElement("div");
  actions.className = "edit-actions";

  const saveBtn = iconBtn("check", "meta-icon-btn edit-save", "저장");
  saveBtn.onclick = () => {
    const val = textarea.value.trim();
    if (!val) return;
    onSave(val);
  };

  const cancelBtn = iconBtn("close", "meta-icon-btn", "취소");
  cancelBtn.onclick = onCancel;

  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);

  wrap.appendChild(textarea);
  wrap.appendChild(actions);
  return wrap;
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
  await persist();

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
