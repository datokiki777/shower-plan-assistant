const DB_NAME = "shower-plan-assistant";
const STORE = "reports";

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
  "floorPanelColor",
  "panelHeight",
  "installables",
  "extraWork",
  "workNotes"
];

const state = {
  report: createEmptyReport()
};

const $ = (selector) => document.querySelector(selector);
const els = {
  clearBtn: $("#clearBtn"),
  clearHistoryBtn: $("#clearHistoryBtn"),
  saveBtn: $("#saveBtn"),
  exportBtn: $("#exportBtn"),
  reportForm: $("#reportForm"),
  historyList: $("#historyList"),
  alertBox: $("#alertBox"),
  reportTitle: $("#reportTitle"),
  sketchPreview: $("#sketchPreview"),
  sketchPreviewEmpty: $("#sketchPreviewEmpty"),
  removeSketchBtn: $("#removeSketchBtn")
};

function createEmptyReport() {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    clientName: "",
    address: "",
    phone: "",
    packageType: "",
    showerTraySize: "",
    antiSlip: "",
    glassPartitionSize: "",
    hingedDoorSize: "",
    panelColor: "",
    floorPanelColor: "",
    panelHeight: "",
    installables: [],
    extraWork: [],
    workNotes: [],
    sketch: null
  };
}

function arrayToText(value) {
  return Array.isArray(value) ? value.join("\n") : value || "";
}

function textToArray(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function hasValue(value) {
  if (Array.isArray(value)) return value.some((item) => String(item || "").trim());
  return Boolean(String(value || "").trim());
}

function showAlert(message, tone = "info") {
  if (!els.alertBox) return;
  els.alertBox.hidden = false;
  els.alertBox.textContent = message;
  els.alertBox.dataset.tone = tone;
}

function clearAlert() {
  if (!els.alertBox) return;
  els.alertBox.hidden = true;
  els.alertBox.textContent = "";
}

function syncFormFromReport() {
  const report = state.report;
  fields.forEach((name) => {
    const input = els.reportForm.elements[name];
    if (!input) return;
    input.value = Array.isArray(report[name]) ? arrayToText(report[name]) : report[name] || "";
  });
  updateTitle();
  updateSketchPreview();
}

function syncReportFromForm() {
  fields.forEach((name) => {
    const input = els.reportForm.elements[name];
    if (!input) return;
    state.report[name] = Array.isArray(createEmptyReport()[name]) ? textToArray(input.value) : input.value.trim();
  });
  updateTitle();
}

function updateTitle() {
  if (!els.reportTitle) return;
  els.reportTitle.textContent = state.report.clientName || "ახალი სამუშაო";
}

function normalizeReport(payload) {
  const report = { ...createEmptyReport(), ...(payload || {}) };
  report.id = payload.id || crypto.randomUUID();
  report.createdAt = payload.createdAt || new Date().toISOString();
  report.sketch = payload.sketch && typeof payload.sketch === "object" ? payload.sketch : null;
  fields.forEach((name) => {
    const isArrayField = Array.isArray(createEmptyReport()[name]);
    if (isArrayField && !Array.isArray(report[name])) report[name] = textToArray(report[name]);
    if (!isArrayField && report[name] == null) report[name] = "";
    if (isArrayField && !Array.isArray(report[name])) report[name] = [];
  });
  return report;
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
  if (showMessage) showAlert("ანგარიში შენახულია ისტორიაში.", "ok");
}

async function renderHistory() {
  if (!els.historyList) return;
  const reports = await getReports();
  els.historyList.innerHTML = "";
  if (!reports.length) {
    els.historyList.innerHTML = '<div class="history-item"><strong>ისტორია ცარიელია</strong><small>შენახული ანგარიშები აქ გამოჩნდება</small></div>';
    return;
  }
  reports.slice(0, 12).forEach((report) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "history-item";
    item.innerHTML = `<strong>${escapeHtml(report.clientName || "უსახელო სამუშაო")}</strong><small>${new Date(report.createdAt).toLocaleString("ka-GE")}</small>`;
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
    .report-section:nth-of-type(6) { background: #edf5e8; border-color: #a9c693; }
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
    .sketch-report-image {
      display: block;
      width: 100%;
      max-height: 720px;
      object-fit: contain;
      border: 1px solid #aebdb9;
      background: #fff;
    }
    .print-actions {
      position: sticky;
      top: 0;
      display: flex;
      justify-content: flex-end;
      padding: 0 0 10px;
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
    showAlert("Android-ზე PDF-სთვის popup უნდა გაიხსნას. ბრაუზერში popup დაუშვი ან სცადე თავიდან.", "warn");
    return;
  }
  popup.document.open();
  popup.document.write(buildStandaloneReportDocument());
  popup.document.close();
}

function buildPrintableReportContent() {
  const section = (title, body) => (body ? `<section class="report-section"><h2>${escapeHtml(title)}</h2>${body}</section>` : "");
  const text = (value) => escapeHtml(value).replace(/\r?\n/g, "<br>");
  const p = (label, value) => (hasValue(value) ? `<p><strong>${escapeHtml(label)}:</strong> ${text(value)}</p>` : "");
  const list = (items) => (hasValue(items) ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "");

  const client = [
    p("კლიენტი", state.report.clientName),
    p("მისამართი", state.report.address),
    p("ტელეფონი", state.report.phone)
  ].join("");
  const packageInfo = [
    p("პაკეტი", state.report.packageType),
    p("დუშთასე", state.report.showerTraySize),
    p("ანტირუჩი", state.report.antiSlip)
  ].join("");
  const materials = [
    p("შუშის ზომა", state.report.glassPartitionSize),
    p("კარი", state.report.hingedDoorSize),
    p("პანელის ფერი", state.report.panelColor),
    p("იატაკის პანელის ფერი", state.report.floorPanelColor),
    p("პანელი სადამდე კეთდება", state.report.panelHeight),
    hasValue(state.report.installables) ? `<h3>დასაყენებლების სია</h3>${list(state.report.installables)}` : ""
  ].join("");
  const sketchImage = window.BathroomSketch?.hasContent(state.report.sketch)
    ? window.BathroomSketch.createImage(state.report.sketch)
    : "";
  const sketch = sketchImage
    ? `<img class="sketch-report-image" src="${sketchImage}" alt="აბაზანის 2D ნახაზი" />`
    : "";

  return `
      <h1>Shower Plan Assistant</h1>
      <p>ქართული სამუშაო ანგარიში</p>
      ${section("კლიენტის მონაცემები", client)}
      ${section("პაკეტი და დუშთასე", packageInfo)}
      ${section("მასალები", materials)}
      ${section("დამატებითი სამუშაოები", list(state.report.extraWork))}
      ${section("შენიშვნები", list(state.report.workNotes))}
      ${section("აბაზანის ნახაზი", sketch)}
    `;
}

function updateSketchPreview() {
  if (!els.sketchPreview || !els.sketchPreviewEmpty || !els.removeSketchBtn) return;
  const hasSketch = Boolean(window.BathroomSketch?.hasContent(state.report.sketch));
  els.sketchPreview.hidden = !hasSketch;
  els.sketchPreviewEmpty.hidden = hasSketch;
  els.removeSketchBtn.hidden = !hasSketch;
  if (hasSketch) {
    els.sketchPreview.src = window.BathroomSketch.createImage(state.report.sketch);
  } else {
    els.sketchPreview.removeAttribute("src");
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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
  els.reportForm.addEventListener("input", () => {
    syncReportFromForm();
    clearAlert();
  });
  els.clearBtn.addEventListener("click", () => {
    state.report = createEmptyReport();
    syncFormFromReport();
    clearAlert();
  });
  els.saveBtn.addEventListener("click", () => saveCurrentReport(true));
  els.exportBtn.addEventListener("click", exportPdf);
  els.removeSketchBtn?.addEventListener("click", () => {
    state.report.sketch = null;
    updateSketchPreview();
    clearAlert();
  });
  els.clearHistoryBtn?.addEventListener("click", async () => {
    await clearReports();
    await renderHistory();
    showAlert("ისტორია წაიშალა.", "info");
  });
}

async function init() {
  window.BathroomSketch?.init({
    getData: () => state.report.sketch,
    setData: (sketch) => {
      state.report.sketch = sketch;
    },
    onSave: () => {
      updateSketchPreview();
      clearAlert();
    }
  });
  bindEvents();
  syncFormFromReport();
  await renderHistory();
  registerServiceWorker();
}

init();
