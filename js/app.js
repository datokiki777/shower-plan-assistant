const UNKNOWN = "გადასამოწმებელია";
const DB_NAME = "shower-plan-assistant";
const STORE = "reports";
const TERM_STORE = "showerPlanTerms";

const fields = [
  "clientName",
  "address",
  "phone",
  "packageType",
  "showerTraySize",
  "antiSlip",
  "glassPartitionSize",
  "hingedDoorSize",
  "panelColor",
  "panelHeight",
  "installables",
  "extraWork",
  "workNotes"
];

const state = {
  files: [],
  report: createEmptyReport()
};

const $ = (selector) => document.querySelector(selector);
const els = {
  dropZone: $("#dropZone"),
  fileInput: $("#fileInput"),
  pickFilesBtn: $("#pickFilesBtn"),
  fileList: $("#fileList"),
  analyzeBtn: $("#analyzeBtn"),
  demoBtn: $("#demoBtn"),
  clearBtn: $("#clearBtn"),
  clearHistoryBtn: $("#clearHistoryBtn"),
  saveBtn: $("#saveBtn"),
  exportBtn: $("#exportBtn"),
  addPriceBtn: $("#addPriceBtn"),
  reportForm: $("#reportForm"),
  priceRows: $("#priceRows"),
  historyList: $("#historyList"),
  alertBox: $("#alertBox"),
  reportTitle: $("#reportTitle"),
  connectionStatus: $("#connectionStatus"),
  apiBaseInput: $("#apiBaseInput"),
  saveApiBaseBtn: $("#saveApiBaseBtn"),
  termGermanInput: $("#termGermanInput"),
  termGeorgianInput: $("#termGeorgianInput"),
  addTermBtn: $("#addTermBtn"),
  clearTermsBtn: $("#clearTermsBtn"),
  termList: $("#termList"),
  usagePercent: $("#usagePercent"),
  usageBar: $("#usageBar"),
  usageText: $("#usageText")
};

function normalizeApiBase(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function getApiBase() {
  return normalizeApiBase(localStorage.getItem("showerPlanApiBase") || window.SHOWER_PLAN_API_BASE || "");
}

function apiUrl(path) {
  const base = getApiBase();
  return base ? `${base}${path}` : path;
}

function isStaticHostedWithoutBackend() {
  return !getApiBase() && !["localhost", "127.0.0.1", ""].includes(window.location.hostname);
}

function createEmptyReport() {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    sourceFiles: [],
    clientName: UNKNOWN,
    address: UNKNOWN,
    phone: UNKNOWN,
    packageType: UNKNOWN,
    showerTraySize: UNKNOWN,
    antiSlip: UNKNOWN,
    glassPartitionSize: UNKNOWN,
    hingedDoorSize: UNKNOWN,
    panelColor: UNKNOWN,
    panelHeight: UNKNOWN,
    installables: [],
    extraWork: [],
    workNotes: [],
    sourceNotes: []
  };
}

function currentUsageKey() {
  const now = new Date();
  return `showerPlanUsage-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getUsageState() {
  try {
    return JSON.parse(localStorage.getItem(currentUsageKey())) || { costUsd: 0, budgetUsd: 5, analyses: 0, lastCostUsd: 0 };
  } catch {
    return { costUsd: 0, budgetUsd: 5, analyses: 0, lastCostUsd: 0 };
  }
}

function saveUsageState(usage) {
  localStorage.setItem(currentUsageKey(), JSON.stringify(usage));
}

function getTerms() {
  try {
    return JSON.parse(localStorage.getItem(TERM_STORE)) || [];
  } catch {
    return [];
  }
}

function saveTerms(terms) {
  localStorage.setItem(TERM_STORE, JSON.stringify(terms));
}

function renderTerms() {
  if (!els.termList) return;
  const terms = getTerms();
  if (!terms.length) {
    els.termList.innerHTML = '<div class="term-item"><span>ჯერ ტერმინი არ არის დამატებული</span></div>';
    return;
  }
  els.termList.innerHTML = "";
  terms.forEach((term, index) => {
    const item = document.createElement("div");
    item.className = "term-item";
    item.innerHTML = `<span><strong>${escapeHtml(term.de)}</strong> = ${escapeHtml(term.ka)}</span><button type="button">×</button>`;
    item.querySelector("button").addEventListener("click", () => {
      const next = getTerms();
      next.splice(index, 1);
      saveTerms(next);
      renderTerms();
    });
    els.termList.appendChild(item);
  });
}

function addTerm() {
  const de = els.termGermanInput?.value.trim();
  const ka = els.termGeorgianInput?.value.trim();
  if (!de || !ka) {
    showAlert("ტერმინისთვის გერმანულიც და ქართულიც ჩაწერე.", "warn");
    return;
  }
  const terms = getTerms().filter((term) => term.de.toLowerCase() !== de.toLowerCase());
  terms.push({ de, ka });
  saveTerms(terms);
  els.termGermanInput.value = "";
  els.termGeorgianInput.value = "";
  renderTerms();
  showAlert("ტერმინი დაემატა ლექსიკონში.", "ok");
}

function addUsageEstimate(usage) {
  if (!usage) return;
  const state = getUsageState();
  const cost = Number(usage.estimatedCostUsd || 0);
  state.costUsd = Number((Number(state.costUsd || 0) + cost).toFixed(6));
  state.budgetUsd = Number(usage.budgetUsd || state.budgetUsd || 5);
  state.analyses = Number(state.analyses || 0) + 1;
  state.lastCostUsd = cost;
  state.lastTokens = Number(usage.totalTokens || 0);
  saveUsageState(state);
}

function renderUsageMeter() {
  const usage = getUsageState();
  const budget = Number(usage.budgetUsd || 5);
  const percent = budget > 0 ? Math.min(100, (Number(usage.costUsd || 0) / budget) * 100) : 0;
  if (els.usagePercent) els.usagePercent.textContent = `${percent.toFixed(percent < 10 ? 1 : 0)}%`;
  if (els.usageBar) els.usageBar.style.width = `${percent}%`;
  if (els.usageText) {
    const last = usage.lastCostUsd ? ` ბოლო ანალიზი ~$${Number(usage.lastCostUsd).toFixed(4)}.` : "";
    els.usageText.textContent = `$${Number(usage.costUsd || 0).toFixed(4)} / $${budget.toFixed(2)} დაახლოებით.${last}`;
  }
}

function arrayToText(value) {
  if (Array.isArray(value)) return value.join("\n");
  return value || "";
}

function textToArray(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function showAlert(message, tone = "info") {
  els.alertBox.hidden = false;
  els.alertBox.textContent = message;
  els.alertBox.dataset.tone = tone;
}

function clearAlert() {
  els.alertBox.hidden = true;
  els.alertBox.textContent = "";
}

function setBusy(isBusy, label = "AI ანალიზი") {
  els.analyzeBtn.disabled = isBusy;
  els.analyzeBtn.textContent = isBusy ? "მუშავდება..." : label;
}

function formatBytes(size) {
  if (!size) return "0 KB";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function renderFiles() {
  els.fileList.innerHTML = "";
  if (!state.files.length) {
    els.fileList.innerHTML = '<div class="file-chip"><strong>ფაილი არჩეული არ არის</strong><small>ატვირთე PDF ან ფოტო</small></div>';
    return;
  }
  state.files.forEach((file) => {
    const node = document.createElement("div");
    node.className = "file-chip";
    node.innerHTML = `<strong>${escapeHtml(file.name)}</strong><small>${escapeHtml(file.type || "file")} · ${formatBytes(file.size)}</small>`;
    els.fileList.appendChild(node);
  });
}

function syncFormFromReport() {
  const report = state.report;
  fields.forEach((name) => {
    const input = els.reportForm.elements[name];
    if (!input) return;
    input.value = Array.isArray(report[name]) ? arrayToText(report[name]) : report[name] || "";
  });
  renderPrices();
  els.reportTitle.textContent = report.clientName && report.clientName !== UNKNOWN ? report.clientName : "ახალი სამუშაო";
}

function syncReportFromForm() {
  fields.forEach((name) => {
    const input = els.reportForm.elements[name];
    if (!input) return;
    state.report[name] = Array.isArray(createEmptyReport()[name]) ? textToArray(input.value) : input.value.trim() || UNKNOWN;
  });
  if (els.priceRows) {
    state.report.prices = [...els.priceRows.querySelectorAll(".price-row")].map((row) => ({
      label: row.querySelector('[data-price="label"]').value.trim() || UNKNOWN,
      amount: row.querySelector('[data-price="amount"]').value.trim() || UNKNOWN
    }));
  }
}

function renderPrices() {
  if (!els.priceRows) return;
  els.priceRows.innerHTML = "";
  const prices = state.report.prices?.length ? state.report.prices : [{ label: UNKNOWN, amount: UNKNOWN }];
  prices.forEach((price, index) => {
    const row = document.createElement("div");
    row.className = "price-row";
    row.innerHTML = `
      <label>პოზიცია <input data-price="label" value="${escapeHtml(price.label || UNKNOWN)}" /></label>
      <label>ფასი <input data-price="amount" value="${escapeHtml(price.amount || UNKNOWN)}" /></label>
      <button type="button" aria-label="ფასის წაშლა" title="ფასის წაშლა">×</button>
    `;
    row.querySelector("button").addEventListener("click", () => {
      state.report.prices.splice(index, 1);
      renderPrices();
    });
    els.priceRows.appendChild(row);
  });
}

function normalizeReport(payload) {
  const report = { ...createEmptyReport(), ...(payload.analysis || payload || {}) };
  report.id = payload.id || crypto.randomUUID();
  report.createdAt = payload.createdAt || new Date().toISOString();
  report.sourceFiles = payload.sourceFiles || state.files.map((file) => file.name);
  fields.forEach((name) => {
    const isArrayField = Array.isArray(createEmptyReport()[name]);
    if (isArrayField && !Array.isArray(report[name])) report[name] = textToArray(report[name]);
    if (!isArrayField && !report[name]) report[name] = UNKNOWN;
    if (isArrayField && !Array.isArray(report[name])) report[name] = [];
  });
  return report;
}

async function analyzeFiles() {
  if (!state.files.length) {
    showAlert("ჯერ ატვირთე მინიმუმ ერთი PDF ან სურათი.", "warn");
    return;
  }
  if (isStaticHostedWithoutBackend()) {
    showAlert("AI ანალიზისთვის ჯერ Backend URL ჩაწერე. Render/Railway deploy-ის შემდეგ URL აქ შეინახება.", "warn");
    return;
  }
  setBusy(true);
  clearAlert();
  try {
    const formData = new FormData();
    state.files.forEach((file) => formData.append("files", file));
    formData.append("glossary", JSON.stringify(getTerms()));
    const response = await fetch(apiUrl("/api/analyze"), { method: "POST", body: formData });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "ანალიზი ვერ შესრულდა");
    state.report = normalizeReport(payload);
    addUsageEstimate(payload.usage);
    renderUsageMeter();
    syncFormFromReport();
    await saveCurrentReport(false);
    const costText = payload.usage?.estimatedCostUsd ? ` დაახლოებით ღირებულება: $${Number(payload.usage.estimatedCostUsd).toFixed(4)}.` : "";
    showAlert(`AI ანალიზი დასრულდა. გადაამოწმე მონიშნული ადგილები და საჭიროებისამებრ ჩაასწორე.${costText}`, "ok");
  } catch (error) {
    showAlert(`${error.message}. შეგიძლია გამოიყენო Demo შედეგი ან გაუშვა Node backend OPENAI_API_KEY-ით.`, "warn");
  } finally {
    setBusy(false);
  }
}

function loadDemo() {
  const fileHint = state.files[0]?.name || "Nazif Demir.pdf";
  state.report = normalizeReport({
    sourceFiles: state.files.map((file) => file.name),
    analysis: {
      clientName: fileHint.replace(/\.pdf$/i, ""),
      address: UNKNOWN,
      phone: UNKNOWN,
      packageType: UNKNOWN,
      showerTraySize: "ზომა დოკუმენტიდან წასაკითხია - გადასამოწმებელია",
      antiSlip: UNKNOWN,
      glassPartitionSize: UNKNOWN,
      hingedDoorSize: UNKNOWN,
      panelColor: UNKNOWN,
      panelHeight: UNKNOWN,
      installables: ["დასაყენებლების სია: გადასამოწმებელია"],
      extraWork: ["დამატებითი სამუშაოები: გადასამოწმებელია"],
      workNotes: ["ხელნაწერი ან skizze სრულად უნდა გადამოწმდეს."]
    }
  });
  syncFormFromReport();
  showAlert("Demo რეჟიმი ჩაიტვირთა. AI backend-ის ჩართვის შემდეგ ეს ველები რეალური PDF-იდან შეივსება.", "info");
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putReport(report) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(report);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function getReports() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
    req.onerror = () => reject(req.error);
  });
}

async function clearReports() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function saveCurrentReport(showMessage = true) {
  syncReportFromForm();
  state.report.createdAt = new Date().toISOString();
  await putReport(state.report);
  await renderHistory();
  if (showMessage) showAlert("ანგარიში ლოკალურად შენახულია IndexedDB-ში.", "ok");
}

async function renderHistory() {
  const reports = await getReports();
  els.historyList.innerHTML = "";
  if (!reports.length) {
    els.historyList.innerHTML = '<div class="history-item"><strong>ისტორია ცარიელია</strong><small>შენახული ანგარიშები აქ გამოჩნდება</small></div>';
    return;
  }
  reports.slice(0, 8).forEach((report) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "history-item";
    item.innerHTML = `<strong>${escapeHtml(report.clientName || UNKNOWN)}</strong><small>${new Date(report.createdAt).toLocaleString("ka-GE")}</small>`;
    item.addEventListener("click", () => {
      state.report = normalizeReport(report);
      syncFormFromReport();
      showAlert("ისტორიიდან ჩაიტვირთა.", "info");
    });
    els.historyList.appendChild(item);
  });
}

function exportPdf() {
  syncReportFromForm();
  if (isAndroidDevice()) {
    printStandaloneReport();
    return;
  }

  const previousReport = document.querySelector(".printable-report");
  if (previousReport) previousReport.remove();

  const report = document.createElement("article");
  report.className = "printable-report";
  report.innerHTML = buildPrintableReportContent();
  document.body.appendChild(report);
  document.body.classList.add("is-printing-report");

  const cleanup = () => {
    document.body.classList.remove("is-printing-report");
    report.remove();
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup);
  window.setTimeout(() => {
    window.print();
    window.setTimeout(cleanup, 2500);
  }, 250);
}

function isAndroidDevice() {
  return /Android/i.test(navigator.userAgent || "");
}

function buildStandaloneReportDocument() {
  return `<!doctype html>
<html lang="ka">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Shower Plan Assistant PDF</title>
  <style>
    @page { margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 10px;
      background: #fff;
      color: #17211f;
      font-family: "Noto Sans Georgian", "Segoe UI", Arial, sans-serif;
      line-height: 1.32;
    }
    .printable-report { display: block; width: 100%; }
    .report-section {
      break-inside: avoid;
      margin: 6px 0;
      padding: 7px 9px;
      border: 1px solid #d9e1df;
      border-radius: 8px;
    }
    .report-section:nth-of-type(1) { background: #dff2eb; border-color: #9ec8bb; }
    .report-section:nth-of-type(2) { background: #ffedc2; border-color: #d7ae50; }
    .report-section:nth-of-type(3) { background: #dceeff; border-color: #9bbfe0; }
    .report-section:nth-of-type(4) { background: #ffe2d8; border-color: #df9e88; }
    .report-section:nth-of-type(5) { background: #ece3ff; border-color: #b7a1dd; }
    h1 { margin: 0 0 3px; font-size: 18px; }
    h2 {
      margin: 0 0 4px;
      font-size: 12px;
      color: #0e5c56;
      border-bottom: 1px solid #d9e1df;
      padding-bottom: 3px;
    }
    h3 { margin: 6px 0 3px; font-size: 11px; }
    p { margin: 1px 0; font-size: 10.5px; }
    ul { margin: 3px 0 0 14px; padding: 0; font-size: 10.5px; }
    .check { background: #fff8e9; border: 1px solid #e7c37e; padding: 10px; }
    .print-actions {
      position: sticky;
      top: 0;
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding: 0 0 12px;
      background: #fff;
    }
    .print-actions button {
      border: 1px solid #cfd9d6;
      border-radius: 8px;
      background: #0e5c56;
      color: #fff;
      padding: 10px 14px;
      font: inherit;
      font-weight: 800;
    }
    @media print {
      body { padding: 0; }
      .print-actions { display: none; }
    }
  </style>
</head>
<body>
  <div class="print-actions"><button onclick="window.print()">Save as PDF</button></div>
  <article class="printable-report">${buildPrintableReportContent()}</article>
  <script>
    window.addEventListener("load", () => setTimeout(() => window.print(), 600));
  <\/script>
</body>
</html>`;
}

function printStandaloneReport() {
  const popup = window.open("", "_blank");
  if (!popup) {
    showAlert("Android-ზე PDF-სთვის popup გაიხსნას უნდა. ბრაუზერში popup დაუშვი ან სცადე თავიდან.", "warn");
    return;
  }
  popup.document.open();
  popup.document.write(buildStandaloneReportDocument());
  popup.document.close();
}

function buildPrintableReportContent() {
  const section = (title, body) => `<section class="report-section"><h2>${escapeHtml(title)}</h2>${body}</section>`;
  const list = (items) => (items?.length ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "");
  return `
      <h1>Shower Plan Assistant</h1>
      <p>ქართული სამუშაო ანგარიში</p>
      ${section("კლიენტის მონაცემები", `<p><strong>კლიენტი:</strong> ${escapeHtml(state.report.clientName)}</p><p><strong>მისამართი:</strong> ${escapeHtml(state.report.address)}</p><p><strong>ტელეფონი:</strong> ${escapeHtml(state.report.phone)}</p>`)}
      ${section("პაკეტი და დუშთასე", `<p><strong>პაკეტი:</strong> ${escapeHtml(state.report.packageType)}</p><p><strong>დუშთასე:</strong> ${escapeHtml(state.report.showerTraySize)}</p><p><strong>ანტირუჩი:</strong> ${escapeHtml(state.report.antiSlip)}</p>`)}
      ${section("მასალები", `<p><strong>შუშის ზომა:</strong> ${escapeHtml(state.report.glassPartitionSize)}</p><p><strong>დასაკიდი კარის ზომა:</strong> ${escapeHtml(state.report.hingedDoorSize)}</p><p><strong>პანელის ფერი:</strong> ${escapeHtml(state.report.panelColor)}</p><p><strong>პანელი სადამდე კეთდება:</strong> ${escapeHtml(state.report.panelHeight)}</p><h3>დასაყენებლების სია</h3>${list(state.report.installables)}`)}
      ${section("დამატებითი სამუშაოები", list(state.report.extraWork))}
      ${section("შენიშვნები", list(state.report.workNotes))}
    `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function checkBackend() {
  if (els.apiBaseInput) els.apiBaseInput.value = getApiBase();
  if (isStaticHostedWithoutBackend()) {
    els.connectionStatus.textContent = "Backend URL საჭიროა";
    return;
  }
  try {
    const response = await fetch(apiUrl("/api/health"));
    els.connectionStatus.textContent = response.ok ? "Backend მზადაა" : "ლოკალური რეჟიმი";
  } catch {
    els.connectionStatus.textContent = "ლოკალური რეჟიმი";
  }
}

function showUpdateToast() {
  let toast = document.querySelector(".update-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "update-toast";
    toast.innerHTML = `
      <div>
        <strong>ახალი ვერსია მზადაა</strong>
        <span>განაახლე app, რომ ბოლო ცვლილებები ჩაიტვირთოს.</span>
      </div>
      <button class="primary" type="button">განახლება</button>
    `;
    toast.querySelector("button").addEventListener("click", () => window.location.reload());
    document.body.appendChild(toast);
  }
  toast.classList.add("is-visible");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  let updateSeen = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (updateSeen) return;
    updateSeen = true;
    showUpdateToast();
  });

  navigator.serviceWorker
    .register("service-worker.js")
    .then((registration) => {
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            worker.postMessage({ type: "SKIP_WAITING" });
            showUpdateToast();
          }
        });
      });

      window.setInterval(() => registration.update(), 60 * 60 * 1000);
    })
    .catch(() => {});
}

function bindEvents() {
  els.pickFilesBtn.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", () => {
    state.files = [...els.fileInput.files];
    renderFiles();
  });
  ["dragenter", "dragover"].forEach((eventName) => {
    els.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.dropZone.classList.add("is-dragging");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    els.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.dropZone.classList.remove("is-dragging");
    });
  });
  els.dropZone.addEventListener("drop", (event) => {
    state.files = [...event.dataTransfer.files].filter((file) => file.type === "application/pdf" || file.type.startsWith("image/"));
    renderFiles();
  });
  els.analyzeBtn.addEventListener("click", analyzeFiles);
  els.demoBtn.addEventListener("click", loadDemo);
  els.clearBtn.addEventListener("click", () => {
    state.files = [];
    state.report = createEmptyReport();
    els.fileInput.value = "";
    renderFiles();
    syncFormFromReport();
    clearAlert();
  });
  if (els.addPriceBtn) {
    els.addPriceBtn.addEventListener("click", () => {
      syncReportFromForm();
      state.report.prices = state.report.prices || [];
      state.report.prices.push({ label: UNKNOWN, amount: UNKNOWN });
      renderPrices();
    });
  }
  els.saveBtn.addEventListener("click", () => saveCurrentReport(true));
  els.exportBtn.addEventListener("click", exportPdf);
  els.clearHistoryBtn.addEventListener("click", async () => {
    await clearReports();
    await renderHistory();
    showAlert("ისტორია წაიშალა.", "info");
  });
  els.addTermBtn?.addEventListener("click", addTerm);
  els.clearTermsBtn?.addEventListener("click", () => {
    saveTerms([]);
    renderTerms();
    showAlert("ტერმინების ლექსიკონი გასუფთავდა.", "info");
  });
  [els.termGermanInput, els.termGeorgianInput].forEach((input) => {
    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") addTerm();
    });
  });
  els.saveApiBaseBtn.addEventListener("click", async () => {
    const value = normalizeApiBase(els.apiBaseInput.value);
    if (value) {
      localStorage.setItem("showerPlanApiBase", value);
    } else {
      localStorage.removeItem("showerPlanApiBase");
    }
    await checkBackend();
    showAlert(value ? "Backend URL შენახულია ამ მოწყობილობაზე." : "Backend URL გასუფთავდა.", "info");
  });
}

async function init() {
  bindEvents();
  renderFiles();
  syncFormFromReport();
  await renderHistory();
  renderUsageMeter();
  renderTerms();
  await checkBackend();
  registerServiceWorker();
}

init();
