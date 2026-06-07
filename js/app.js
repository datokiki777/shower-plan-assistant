const UNKNOWN = "გადასამოწმებელია";
const DB_NAME = "shower-plan-assistant";
const STORE = "reports";

const fields = [
  "clientName",
  "address",
  "orderNumber",
  "date",
  "showerTraySize",
  "glassSizes",
  "panelTypes",
  "fittings",
  "extraWork",
  "totalPrice",
  "workNotes",
  "suspiciousItems",
  "translatedSummaryKa"
];

const sketchFields = ["door", "wc", "window", "showerTray", "fixedGlass", "movingGlass", "panelWalls"];

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
  saveApiBaseBtn: $("#saveApiBaseBtn")
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
    orderNumber: UNKNOWN,
    date: UNKNOWN,
    showerTraySize: UNKNOWN,
    glassSizes: [],
    panelTypes: [],
    fittings: [],
    extraWork: [],
    prices: [{ label: UNKNOWN, amount: UNKNOWN }],
    totalPrice: UNKNOWN,
    workNotes: [],
    sketchExplanation: Object.fromEntries(sketchFields.map((key) => [key, UNKNOWN])),
    suspiciousItems: [UNKNOWN],
    translatedSummaryKa: UNKNOWN
  };
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
  sketchFields.forEach((name) => {
    const input = els.reportForm.elements[name];
    if (input) input.value = report.sketchExplanation?.[name] || UNKNOWN;
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
  state.report.sketchExplanation = state.report.sketchExplanation || {};
  sketchFields.forEach((name) => {
    const input = els.reportForm.elements[name];
    state.report.sketchExplanation[name] = input?.value.trim() || UNKNOWN;
  });
  state.report.prices = [...els.priceRows.querySelectorAll(".price-row")].map((row) => ({
    label: row.querySelector('[data-price="label"]').value.trim() || UNKNOWN,
    amount: row.querySelector('[data-price="amount"]').value.trim() || UNKNOWN
  }));
}

function renderPrices() {
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
  report.sketchExplanation = { ...createEmptyReport().sketchExplanation, ...(report.sketchExplanation || {}) };
  fields.forEach((name) => {
    if (Array.isArray(createEmptyReport()[name]) && !Array.isArray(report[name])) report[name] = textToArray(report[name]);
    if (!report[name] || (Array.isArray(report[name]) && report[name].length === 0)) report[name] = Array.isArray(createEmptyReport()[name]) ? [UNKNOWN] : UNKNOWN;
  });
  if (!Array.isArray(report.prices) || !report.prices.length) report.prices = [{ label: UNKNOWN, amount: UNKNOWN }];
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
    const response = await fetch(apiUrl("/api/analyze"), { method: "POST", body: formData });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "ანალიზი ვერ შესრულდა");
    state.report = normalizeReport(payload);
    syncFormFromReport();
    await saveCurrentReport(false);
    showAlert("AI ანალიზი დასრულდა. გადაამოწმე მონიშნული ადგილები და საჭიროებისამებრ ჩაასწორე.", "ok");
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
      orderNumber: UNKNOWN,
      date: UNKNOWN,
      showerTraySize: "ზომა დოკუმენტიდან წასაკითხია - გადასამოწმებელია",
      glassSizes: ["ფიქსირებული შუშა: გადასამოწმებელია", "მოძრავი შუშა/კარი: გადასამოწმებელია"],
      panelTypes: ["პანელის ტიპი და ფართობი: გადასამოწმებელია"],
      fittings: ["არმატურა: გადასამოწმებელია"],
      extraWork: ["დამატებითი სამუშაოები: გადასამოწმებელია"],
      prices: [{ label: "მასალები და მონტაჟი", amount: UNKNOWN }],
      totalPrice: UNKNOWN,
      workNotes: ["ხელნაწერი ან skizze სრულად უნდა გადამოწმდეს."],
      sketchExplanation: {
        door: UNKNOWN,
        wc: UNKNOWN,
        window: UNKNOWN,
        showerTray: UNKNOWN,
        fixedGlass: UNKNOWN,
        movingGlass: UNKNOWN,
        panelWalls: UNKNOWN
      },
      suspiciousItems: ["ზომები", "ხელნაწერი შენიშვნები", "ჯამური ფასი"],
      translatedSummaryKa: "დოკუმენტი ეხება დუშის ზონის სამუშაოს. ზუსტი ზომები, განლაგება და ფასები გადასამოწმებელია ორიგინალ PDF-ში."
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
  const reportHtml = buildPrintableReport();
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) {
    showAlert("ბრაუზერმა PDF export ფანჯარა დაბლოკა. დაუშვი popup და სცადე თავიდან.", "warn");
    return;
  }
  printWindow.document.write(reportHtml);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 350);
}

function buildPrintableReport() {
  const priceRows = state.report.prices
    .map((price) => `<tr><td>${escapeHtml(price.label)}</td><td>${escapeHtml(price.amount)}</td></tr>`)
    .join("");
  const section = (title, body) => `<section><h2>${escapeHtml(title)}</h2>${body}</section>`;
  const list = (items) => `<ul>${(items?.length ? items : [UNKNOWN]).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  return `<!doctype html>
    <html lang="ka">
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(state.report.clientName || "Shower report")}</title>
      <style>
        @page { margin: 18mm; }
        body { font-family: "Noto Sans Georgian", "Segoe UI", Arial, sans-serif; color: #17211f; line-height: 1.5; }
        h1 { margin: 0 0 6px; font-size: 26px; }
        h2 { margin: 24px 0 8px; font-size: 15px; color: #0e5c56; border-bottom: 1px solid #d9e1df; padding-bottom: 5px; }
        p { margin: 4px 0; }
        ul { margin: 6px 0 0 20px; padding: 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        td, th { border: 1px solid #d9e1df; padding: 8px; vertical-align: top; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; margin-top: 16px; }
        .check { background: #fff8e9; border: 1px solid #e7c37e; padding: 10px; }
      </style>
    </head>
    <body>
      <h1>Shower Plan Assistant</h1>
      <p>ქართული სამუშაო ანგარიში</p>
      <div class="meta">
        <p><strong>კლიენტი:</strong> ${escapeHtml(state.report.clientName)}</p>
        <p><strong>თარიღი:</strong> ${escapeHtml(state.report.date)}</p>
        <p><strong>მისამართი:</strong> ${escapeHtml(state.report.address)}</p>
        <p><strong>შეკვეთის ნომერი:</strong> ${escapeHtml(state.report.orderNumber)}</p>
      </div>
      ${section("სამუშაოს მოკლე აღწერა", `<p>${escapeHtml(state.report.translatedSummaryKa)}</p><p><strong>დუშტასე:</strong> ${escapeHtml(state.report.showerTraySize)}</p>`)}
      ${section("მასალები", `<h3>შუშის ზომები</h3>${list(state.report.glassSizes)}<h3>პანელები / ფართობი</h3>${list(state.report.panelTypes)}<h3>არმატურა</h3>${list(state.report.fittings)}`)}
      ${section("ნახაზის ახსნა", `<table><tbody>${sketchFields.map((key) => `<tr><th>${escapeHtml(labelForSketch(key))}</th><td>${escapeHtml(state.report.sketchExplanation[key])}</td></tr>`).join("")}</tbody></table>`)}
      ${section("დამატებითი სამუშაოები", list(state.report.extraWork))}
      ${section("ფასების ცხრილი", `<table><thead><tr><th>პოზიცია</th><th>ფასი</th></tr></thead><tbody>${priceRows}<tr><th>ჯამი</th><th>${escapeHtml(state.report.totalPrice)}</th></tr></tbody></table>`)}
      ${section("შენიშვნები", list(state.report.workNotes))}
      ${section("საეჭვო / გადასამოწმებელი ადგილები", `<div class="check">${list(state.report.suspiciousItems)}</div>`)}
    </body>
    </html>`;
}

function labelForSketch(key) {
  return {
    door: "კარი",
    wc: "WC",
    window: "ფანჯარა",
    showerTray: "დუშტასე",
    fixedGlass: "ფიქსირებული შუშა",
    movingGlass: "მოძრავი შუშა",
    panelWalls: "პანელით დასაფარი კედლები"
  }[key];
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
  els.addPriceBtn.addEventListener("click", () => {
    syncReportFromForm();
    state.report.prices.push({ label: UNKNOWN, amount: UNKNOWN });
    renderPrices();
  });
  els.saveBtn.addEventListener("click", () => saveCurrentReport(true));
  els.exportBtn.addEventListener("click", exportPdf);
  els.clearHistoryBtn.addEventListener("click", async () => {
    await clearReports();
    await renderHistory();
    showAlert("ისტორია წაიშალა.", "info");
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
  await checkBackend();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

init();
