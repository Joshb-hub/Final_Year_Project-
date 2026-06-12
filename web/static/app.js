// ── Parser ────────────────────────────────────────────────────
import { renderContent } from '/static/parser.js';

// ── State ─────────────────────────────────────────────────────
let sessionId = localStorage.getItem("aegisrag_session_id");
let uploadedFiles = [];
let lastAnswer = "";

const HISTORY_KEY = "aegisrag_history";
const MODE_KEY    = "aegisrag_mode";

const MODES = {
  precise: {
    label: "Precise",
    hint: "Concise, summarized answers from PDF context",
    activeText: "Precise mode active — answers will be concise and directly from the PDF.",
    prefix: "",  // no prefix — default RAG behaviour
  },
  pointwise: {
    label: "Point-Wise",
    hint: "All occurrences listed in numbered bullet points",
    activeText: "Point-Wise mode active — every occurrence will be listed as numbered bullet points.",
    prefix: "Answer the following question in a clear, numbered point-wise format. Cover EVERY relevant occurrence and mention from across the entire document. Do not summarise — list each point separately:\n\n",
  },
  detailed: {
    label: "Detailed",
    hint: "PDF context + Gemini knowledge base for deep answers",
    activeText: "Detailed mode active — Gemini will combine PDF context with its own knowledge for a comprehensive answer.",
    prefix: "Provide a comprehensive and detailed answer. Use the document context as your primary source, but also draw on your own knowledge base to add background, examples, related concepts, and deeper explanations where helpful:\n\n",
  },
};

// ── DOM refs ───────────────────────────────────────────────────
const dropzone        = document.getElementById("dropzone");
const browseBtn       = document.getElementById("browse-btn");
const pdfInput        = document.getElementById("pdf-input");
const pdfList         = document.getElementById("pdf-list");
const uploadInfo      = document.getElementById("upload-info");

const selectedDocCard = document.getElementById("selected-doc");
const selectedDocName = document.getElementById("selected-doc-name");
const selectedDocSize = document.getElementById("selected-doc-size");
const selectedDocCheck= document.getElementById("selected-doc-check");

const questionInput   = document.getElementById("question-input");
const charCount       = document.getElementById("char-count");
const askBtn          = document.getElementById("ask-btn");
const newQuestionBtn  = document.getElementById("new-question-btn");
const copyAnswerBtn   = document.getElementById("copy-answer-btn");
const resetButton     = document.getElementById("reset-button");
const statusText      = document.getElementById("status-text");

const loadingOverlay  = document.getElementById("loading-overlay");
const loadingMessage  = document.getElementById("loading-message");

const navItems        = document.querySelectorAll(".nav-item");

// Classification
const queryTypeText   = document.getElementById("query-type-text");
const confidenceBar   = document.getElementById("confidence-bar");
const confidenceScore = document.getElementById("confidence-score");
const strategyTopk    = document.getElementById("strategy-topk");
const strategyType    = document.getElementById("strategy-type");
const strategyFocus   = document.getElementById("strategy-focus");

// History
const historyList     = document.getElementById("history-list");
const historyEmpty    = document.getElementById("history-empty");
const clearHistoryBtn = document.getElementById("clear-history-btn");
const historyModal    = document.getElementById("history-modal");
const modalBackdrop   = document.getElementById("modal-backdrop");
const modalClose      = document.getElementById("modal-close");
const modalTypeBadge  = document.getElementById("modal-type-badge");
const modalChunks     = document.getElementById("modal-chunks");
const modalQuestion   = document.getElementById("modal-question");
const modalAnswer     = document.getElementById("modal-answer");
const modalTimestamp  = document.getElementById("modal-timestamp");
const modalCopyBtn    = document.getElementById("modal-copy-btn");
const modalReaskBtn   = document.getElementById("modal-reask-btn");

// Sections
const sections = {
  home:           document.getElementById("section-home"),
  ask:            document.getElementById("section-ask"),
  classification: document.getElementById("section-classification"),
  context:        document.getElementById("section-context"),
  answer:         document.getElementById("section-answer"),
  settings:       document.getElementById("section-settings"),
  history:        document.getElementById("section-history"),
};

// Mode DOM refs
const askModeBadge  = document.getElementById("ask-mode-badge");
const askModeHint   = document.getElementById("ask-mode-hint");
const modeActiveText= document.getElementById("mode-active-text");
const modeCards     = document.querySelectorAll(".mode-card");

// ── Helpers ────────────────────────────────────────────────────
function showLoading(msg = "Processing…") {
  loadingMessage.textContent = msg;
  loadingOverlay.classList.remove("hidden");
}
function hideLoading() { loadingOverlay.classList.add("hidden"); }

function showSection(id) {
  Object.entries(sections).forEach(([key, el]) => el.classList.toggle("hidden", key !== id));
  navItems.forEach(n => n.classList.toggle("active", n.dataset.target === id));
}

function showSections(...ids) {
  Object.entries(sections).forEach(([key, el]) => el.classList.toggle("hidden", !ids.includes(key)));
}

function toast(msg, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ── Mode management ────────────────────────────────────────────────────
function getCurrentMode() {
  return localStorage.getItem(MODE_KEY) || "precise";
}

function applyMode(mode) {
  if (!MODES[mode]) mode = "precise";
  localStorage.setItem(MODE_KEY, mode);

  // Update mode cards
  modeCards.forEach(card => {
    const isActive = card.dataset.mode === mode;
    card.classList.toggle("active", isActive);
    const checkId = "check-" + card.dataset.mode;
    const checkEl = document.getElementById(checkId);
    if (checkEl) checkEl.classList.toggle("hidden", !isActive);
  });

  // Update active-info text
  if (modeActiveText) modeActiveText.textContent = MODES[mode].activeText;

  // Update ask-section badge
  if (askModeBadge) {
    askModeBadge.textContent = MODES[mode].label;
    askModeBadge.style.background =
      mode === "pointwise" ? "var(--blue)" :
      mode === "detailed"  ? "var(--orange)" :
      "var(--primary)";
  }
  if (askModeHint) askModeHint.textContent = MODES[mode].hint;
}

function initMode() { applyMode(getCurrentMode()); }

// Mode card click handlers
modeCards.forEach(card => {
  card.addEventListener("click", () => applyMode(card.dataset.mode));
});

// ── Session ────────────────────────────────────────────────────
async function ensureSession() {
  if (sessionId) return sessionId;
  const resp = await fetch("/api/sessions", { method: "POST" });
  if (!resp.ok) throw new Error("Could not create session.");
  const data = await resp.json();
  sessionId = data.session_id;
  localStorage.setItem("aegisrag_session_id", sessionId);
  return sessionId;
}

// ── History: localStorage helpers ─────────────────────────────
function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
  catch { return []; }
}

function saveHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function addToHistory(entry) {
  const history = getHistory();
  history.unshift(entry); // newest first
  if (history.length > 100) history.pop(); // cap at 100 entries
  saveHistory(history);
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

// ── History: timestamp formatting ─────────────────────────────
function formatHistoryTime(ts) {
  const date  = new Date(ts);
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const itemDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  let label;
  if (itemDay.getTime() === today.getTime()) {
    label = "Today";
  } else if (itemDay.getTime() === yesterday.getTime()) {
    label = "Yesterday";
  } else {
    label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return { date: label, time };
}

// ── History: icons per type ────────────────────────────────────
function getTypeIcon(queryType) {
  if (queryType === "summarization") {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  }
  if (queryType === "comparison") {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`;
  }
  // factual (default)
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="12" y1="7" x2="12" y2="13"/></svg>`;
}

// ── History: render list ───────────────────────────────────────
function renderHistoryList() {
  const history = getHistory();
  historyList.innerHTML = "";

  if (!history.length) {
    historyEmpty.classList.remove("hidden");
    return;
  }

  historyEmpty.classList.add("hidden");

  history.forEach(entry => {
    const { date, time } = formatHistoryTime(entry.timestamp);
    const typeLabel = entry.queryType.charAt(0).toUpperCase() + entry.queryType.slice(1);

    const item = document.createElement("div");
    item.className = `history-item ${entry.queryType}`;
    item.dataset.id = entry.id;
    item.innerHTML = `
      <div class="history-item-icon ${entry.queryType}">
        ${getTypeIcon(entry.queryType)}
      </div>
      <div class="history-item-content">
        <div class="history-item-question">${escapeHtml(entry.question)}</div>
        <div class="history-item-meta">
          <span class="history-type ${entry.queryType}">Type: ${typeLabel}</span>
          <span class="history-dot">•</span>
          <span class="history-chunks">${entry.chunksCount} chunks</span>
        </div>
      </div>
      <div class="history-item-time">
        <span class="history-time-date">${date}</span>
        <span class="history-time-hour">${time}</span>
      </div>
      <div class="history-item-arrow">›</div>`;

    item.addEventListener("click", () => openHistoryModal(entry));
    historyList.appendChild(item);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// ── History: modal ─────────────────────────────────────────────
let activeModalEntry = null;

function openHistoryModal(entry) {
  activeModalEntry = entry;
  const typeLabel = entry.queryType.charAt(0).toUpperCase() + entry.queryType.slice(1);
  const { date, time } = formatHistoryTime(entry.timestamp);

  modalTypeBadge.textContent = typeLabel;
  modalTypeBadge.className = `history-modal-type-badge ${entry.queryType}`;
  modalChunks.textContent = `${entry.chunksCount} chunk${entry.chunksCount !== 1 ? "s" : ""} retrieved`;
  modalQuestion.textContent = entry.question;
  modalAnswer.innerHTML = renderContent(entry.answer);
  modalTimestamp.textContent = `${date} at ${time}${entry.docName ? "  ·  " + entry.docName : ""}`;  

  historyModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeHistoryModal() {
  historyModal.classList.add("hidden");
  document.body.style.overflow = "";
  activeModalEntry = null;
}

modalClose.addEventListener("click", closeHistoryModal);
modalBackdrop.addEventListener("click", closeHistoryModal);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeHistoryModal(); });

modalCopyBtn.addEventListener("click", async () => {
  if (!activeModalEntry) return;
  try {
    await navigator.clipboard.writeText(activeModalEntry.answer);
    toast("Answer copied!", "success");
  } catch { toast("Could not copy.", "error"); }
});

modalReaskBtn.addEventListener("click", () => {
  if (!activeModalEntry) return;
  questionInput.value = activeModalEntry.question;
  charCount.textContent = activeModalEntry.question.length;
  closeHistoryModal();
  // Switch to ask section
  navItems.forEach(n => n.classList.remove("active"));
  document.getElementById("nav-ask").classList.add("active");
  showSection("ask");
  sections.ask.scrollIntoView({ behavior: "smooth" });
});

clearHistoryBtn.addEventListener("click", () => {
  if (!getHistory().length) return;
  clearHistory();
  renderHistoryList();
  toast("History cleared.", "info");
});

// ── Render PDF list ────────────────────────────────────────────
function renderPdfItem(file, statusEl = "uploading") {
  const item = document.createElement("div");
  item.className = "pdf-item";
  item.id = `pdf-item-${file.name.replace(/\W/g, "_")}`;

  const spinSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`;
  const checkSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;

  item.innerHTML = `
    <div class="pdf-icon">PDF</div>
    <div class="pdf-info">
      <div class="pdf-name">${file.name}</div>
      <div class="pdf-size">${formatBytes(file.size)}</div>
    </div>
    <div class="pdf-status ${statusEl}">
      ${statusEl === "uploading" ? spinSvg : checkSvg}
    </div>`;

  return item;
}

function updatePdfItemStatus(name) {
  const id = `pdf-item-${name.replace(/\W/g, "_")}`;
  const item = document.getElementById(id);
  if (!item) return;
  const statusDiv = item.querySelector(".pdf-status");
  const checkSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
  statusDiv.className = "pdf-status";
  statusDiv.innerHTML = checkSvg;
}

// ── Upload flow ────────────────────────────────────────────────
function handleFiles(files) {
  const pdfs = Array.from(files).filter(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
  if (!pdfs.length) { toast("Please select PDF files only.", "error"); return; }

  pdfList.innerHTML = "";
  uploadedFiles = pdfs;
  pdfs.forEach(file => pdfList.appendChild(renderPdfItem(file, "uploading")));
  uploadFiles(pdfs);
}

async function uploadFiles(files) {
  showLoading("Indexing PDFs…");
  try {
    const sid = await ensureSession();
    const formData = new FormData();
    formData.append("session_id", sid);
    files.forEach(f => formData.append("files", f));

    const resp = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await resp.json();

    if (!resp.ok) { toast(data.detail || "Upload failed.", "error"); return; }

    data.indexed_files.forEach(f => updatePdfItemStatus(f.name));
    uploadInfo.style.display = "none";

    const firstFile = files[0];
    selectedDocName.textContent = firstFile.name;
    selectedDocSize.textContent = formatBytes(firstFile.size);
    selectedDocCard.classList.add("has-file");
    selectedDocCheck.classList.remove("hidden");
    askBtn.disabled = false;

    toast(`${files.length} PDF${files.length > 1 ? "s" : ""} indexed!`, "success");
  } catch (err) {
    toast(err.message || "Upload error.", "error");
  } finally {
    hideLoading();
  }
}

// ── Strategy lookup ────────────────────────────────────────────
function getStrategyForType(queryType) {
  switch (queryType) {
    case "factual":       return { topk: 4, type: "Narrow",  focus: "High precision factual retrieval",   confidence: 0.94 };
    case "summarization": return { topk: 8, type: "Broad",   focus: "Wide coverage across sections",      confidence: 0.88 };
    case "comparison":    return { topk: 6, type: "Diverse", focus: "Multi-document cross-comparison",    confidence: 0.85 };
    default:              return { topk: 4, type: "Narrow",  focus: "General retrieval",                  confidence: 0.80 };
  }
}

// ── Ask flow ───────────────────────────────────────────────────
async function askQuestion() {
  const question = questionInput.value.trim();
  if (!question) { toast("Please enter a question.", "error"); return; }
  if (!sessionId) { toast("Upload a PDF first.", "error"); return; }

  showLoading("Classifying query and retrieving context…");
  askBtn.disabled = true;

  try {
    // ── Build question with mode prefix ───────────────────────────────────────
    const currentMode = getCurrentMode();
    const modePrefix  = MODES[currentMode]?.prefix || "";
    const augmentedQuestion = modePrefix + question;

    const resp = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: await ensureSession(), question: augmentedQuestion }),
    });
    const data = await resp.json();

    if (!resp.ok) { toast(data.detail || "Question failed.", "error"); return; }

    const qt = data.query_type || "factual";
    const strategy = getStrategyForType(qt);

    // ── Classification section ────────────────────────────────
    queryTypeText.textContent = qt.charAt(0).toUpperCase() + qt.slice(1);
    queryTypeText.className = `qt-value ${qt}`;
    confidenceScore.textContent = strategy.confidence.toFixed(2);
    strategyTopk.textContent = strategy.topk;
    strategyType.textContent = strategy.type;
    strategyFocus.textContent = strategy.focus;
    requestAnimationFrame(() => { confidenceBar.style.width = `${Math.round(strategy.confidence * 100)}%`; });

    // ── Context chunks ────────────────────────────────────────
    const chunksEl = document.getElementById("chunks-list");
    chunksEl.innerHTML = "";
    document.getElementById("chunks-badge").textContent = `${data.sources.length} Chunks Retrieved`;

    data.sources.forEach((src, i) => {
      const card = document.createElement("div");
      card.className = "chunk-card";
      const snippet = src.text.slice(0, 300);
      const hasMore = src.text.length > 300;
      card.innerHTML = `
        <div class="chunk-header">
          <span class="chunk-title">Chunk ${i + 1}</span>
          <span class="chunk-score">Score: ${src.score.toFixed(2)}</span>
        </div>
        <div class="chunk-text rendered-content">${renderContent(snippet)}${hasMore ? '<span class="chunk-ellipsis">…</span>' : ''}</div>
        <div class="chunk-source">${src.document_name} · page ${src.page_number}</div>`;
      chunksEl.appendChild(card);
    });

    // ── Answer ────────────────────────────────────────────────────
    lastAnswer = data.answer;
    document.getElementById("answer-text").innerHTML = renderContent(data.answer);

    sections.classification.classList.remove("hidden");
    sections.context.classList.remove("hidden");
    sections.answer.classList.remove("hidden");
    sections.classification.scrollIntoView({ behavior: "smooth", block: "start" });

    // ── Save to history ───────────────────────────────────────
    const docName = selectedDocName.textContent !== "No document uploaded" ? selectedDocName.textContent : "";
    addToHistory({
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
      question,          // save the original question, not the mode-prefixed one
      answer: data.answer,
      queryType: qt,
      chunksCount: data.sources.length,
      docName,
      mode: currentMode,
      timestamp: Date.now(),
    });

    toast("Answer generated!", "success");
  } catch (err) {
    toast(err.message || "Failed to get answer.", "error");
  } finally {
    hideLoading();
    askBtn.disabled = false;
  }
}

// ── Nav clicks ─────────────────────────────────────────────────
navItems.forEach(item => {
  item.addEventListener("click", () => {
    navItems.forEach(n => n.classList.remove("active"));
    item.classList.add("active");

    const target = item.dataset.target;
    if (target === "home" || target === "upload") {
      showSections("home", "ask");
      document.getElementById("nav-home").classList.add("active");
    } else if (target === "ask") {
      showSection("ask");
    } else if (target === "history") {
      renderHistoryList();
      showSection("history");
    } else if (target === "settings") {
      showSection("settings");
    } else if (target === "about") {
      toast("AegisRAG v0.1.0 — Powered by Gemini AI & FAISS.", "info");
    }
  });
});

// ── Dropzone ───────────────────────────────────────────────────
browseBtn.addEventListener("click", e => { e.stopPropagation(); pdfInput.click(); });
dropzone.addEventListener("click", () => pdfInput.click());
pdfInput.addEventListener("change", () => { if (pdfInput.files.length) handleFiles(pdfInput.files); });

["dragenter", "dragover"].forEach(ev =>
  dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add("is-dragging"); })
);
["dragleave", "drop"].forEach(ev =>
  dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove("is-dragging"); })
);
dropzone.addEventListener("drop", e => handleFiles(e.dataTransfer.files));

// ── Textarea ───────────────────────────────────────────────────
questionInput.addEventListener("input", () => { charCount.textContent = questionInput.value.length; });

// ── Ask ────────────────────────────────────────────────────────
askBtn.addEventListener("click", askQuestion);
questionInput.addEventListener("keydown", e => { if (e.ctrlKey && e.key === "Enter") askQuestion(); });

// ── New question ───────────────────────────────────────────────
newQuestionBtn.addEventListener("click", () => {
  questionInput.value = "";
  charCount.textContent = "0";
  sections.classification.classList.add("hidden");
  sections.context.classList.add("hidden");
  sections.answer.classList.add("hidden");
  sections.ask.scrollIntoView({ behavior: "smooth" });
});

// ── Copy answer ────────────────────────────────────────────────
copyAnswerBtn.addEventListener("click", async () => {
  if (!lastAnswer) return;
  try { await navigator.clipboard.writeText(lastAnswer); toast("Copied!", "success"); }
  catch { toast("Could not copy.", "error"); }
});

// ── Reset session ──────────────────────────────────────────────
resetButton.addEventListener("click", async () => {
  if (sessionId) {
    try { await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" }); } catch {}
  }
  localStorage.removeItem("aegisrag_session_id");
  sessionId = null;
  uploadedFiles = [];
  lastAnswer = "";
  pdfList.innerHTML = "";
  questionInput.value = "";
  charCount.textContent = "0";
  selectedDocName.textContent = "No document uploaded";
  selectedDocSize.textContent = "";
  selectedDocCard.classList.remove("has-file");
  selectedDocCheck.classList.add("hidden");
  uploadInfo.style.display = "";
  askBtn.disabled = true;
  sections.classification.classList.add("hidden");
  sections.context.classList.add("hidden");
  sections.answer.classList.add("hidden");
  toast("Session reset.", "info");
});

// ── Init ───────────────────────────────────────────────────────
(async () => {
  sections.classification.classList.add("hidden");
  sections.context.classList.add("hidden");
  sections.answer.classList.add("hidden");
  sections.history.classList.add("hidden");
  sections.settings.classList.add("hidden");

  initMode();

  try {
    await ensureSession();
    statusText.textContent = "Active";
  } catch {
    statusText.textContent = "Offline";
    toast("Could not connect to server.", "error");
  }
})();
