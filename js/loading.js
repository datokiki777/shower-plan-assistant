(function () {
  const $ = (selector) => document.querySelector(selector);

  const SIMPLE_LISTS = ["trays", "glass", "doors"];
  const QTY_LISTS = ["panels", "extras"];

  const els = {};
  let state = { loading: createEmptyLoading() };
  let initialized = false;

  function createEmptyLoading() {
    return {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      title: "",
      trays: [],
      glass: [],
      doors: [],
      panels: [],
      extras: []
    };
  }

  function newSimpleItem() {
    return { id: crypto.randomUUID(), note: "", checked: false };
  }
  function newQtyItem() {
    return { id: crypto.randomUUID(), name: "", qty: "", checked: false };
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

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  // ---- Rendering ----

  function renderAll() {
    els.titleInput.value = state.loading.title || "";
    els.titleLabel.textContent = state.loading.title || "ახალი დატვირთვა";
    SIMPLE_LISTS.forEach(renderSimpleList);
    QTY_LISTS.forEach(renderQtyList);
  }

  function renderSimpleList(listName) {
    const container = els.containers[listName];
    const items = state.loading[listName];
    container.innerHTML = "";
    items.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "loading-item-row";
      row.innerHTML = `
        <span class="loading-item-num">${index + 1}</span>
        <input type="checkbox" class="loading-check" ${item.checked ? "checked" : ""} />
        <input type="text" class="loading-note" placeholder="შენიშვნა (არასავალდებულო)" value="${escapeHtml(item.note)}" />
        <button type="button" class="loading-remove-btn" aria-label="წაშლა">×</button>
      `;
      row.querySelector(".loading-check").addEventListener("change", (event) => {
        item.checked = event.target.checked;
        clearAlert();
      });
      row.querySelector(".loading-note").addEventListener("input", (event) => {
        item.note = event.target.value;
        clearAlert();
      });
      row.querySelector(".loading-remove-btn").addEventListener("click", () => {
        items.splice(index, 1);
        renderSimpleList(listName);
        clearAlert();
      });
      container.appendChild(row);
    });
    if (!items.length) {
      container.innerHTML = '<p class="loading-empty">სია ცარიელია</p>';
    }
  }

  function renderQtyList(listName) {
    const container = els.containers[listName];
    const items = state.loading[listName];
    container.innerHTML = "";
    items.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "loading-item-row loading-item-row-qty";
      row.innerHTML = `
        <input type="checkbox" class="loading-check" ${item.checked ? "checked" : ""} />
        <input type="text" class="loading-name" placeholder="დასახელება" value="${escapeHtml(item.name)}" />
        <input type="text" class="loading-qty" placeholder="რაოდ." value="${escapeHtml(item.qty)}" />
        <button type="button" class="loading-remove-btn" aria-label="წაშლა">×</button>
      `;
      row.querySelector(".loading-check").addEventListener("change", (event) => {
        item.checked = event.target.checked;
        clearAlert();
      });
      row.querySelector(".loading-name").addEventListener("input", (event) => {
        item.name = event.target.value;
        clearAlert();
      });
      row.querySelector(".loading-qty").addEventListener("input", (event) => {
        item.qty = event.target.value;
        clearAlert();
      });
      row.querySelector(".loading-remove-btn").addEventListener("click", () => {
        items.splice(index, 1);
        renderQtyList(listName);
        clearAlert();
      });
      container.appendChild(row);
    });
    if (!items.length) {
      container.innerHTML = '<p class="loading-empty">სია ცარიელია</p>';
    }
  }

  // ---- Persistence ----

  function hasAnyContent(loading) {
    return [...SIMPLE_LISTS, ...QTY_LISTS].some((key) => loading[key] && loading[key].length);
  }

  async function saveCurrentLoading() {
    if (!hasAnyContent(state.loading)) {
      showAlert("სია ცარიელია, დაამატე მინიმუმ ერთი ჩანაწერი შენახვამდე.", "warn");
      return;
    }
    state.loading.createdAt = new Date().toISOString();
    await window.AppDB.putRecord(window.AppDB.LOADING_STORE, state.loading);
    await renderHistory();
    showAlert("დატვირთვის სია შენახულია.", "ok");
  }

  async function renderHistory() {
    if (!els.historyList) return;
    const items = await window.AppDB.getRecords(window.AppDB.LOADING_STORE);
    els.historyList.innerHTML = "";
    if (!items.length) {
      els.historyList.innerHTML = '<div class="history-item"><strong>ისტორია ცარიელია</strong><small>შენახული დატვირთვის სიები აქ გამოჩნდება</small></div>';
      return;
    }
    items.slice(0, 12).forEach((record) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "history-item";
      item.innerHTML = `<strong>${escapeHtml(record.title || "უსახელო დატვირთვა")}</strong><small>${new Date(record.createdAt).toLocaleString("ka-GE")}</small>`;
      item.addEventListener("click", () => {
        state.loading = { ...createEmptyLoading(), ...record };
        renderAll();
        showAlert("ისტორიიდან ჩაიტვირთა.", "info");
      });
      els.historyList.appendChild(item);
    });
  }

  // ---- Export ----

  function buildPrintableLoadingContent() {
    const section = (title, body) => (body ? `<section class="report-section"><h2>${escapeHtml(title)}</h2>${body}</section>` : "");
    const checkMark = (checked) => (checked ? "✓" : "☐");

    const simpleListHtml = (items, fallbackLabel) =>
      items.length
        ? `<ul>${items.map((item, i) => `<li>${checkMark(item.checked)} ${i + 1}. ${escapeHtml(item.note) || fallbackLabel + " " + (i + 1)}</li>`).join("")}</ul>`
        : "";

    const qtyListHtml = (items) =>
      items.length
        ? `<ul>${items.map((item) => `<li>${checkMark(item.checked)} ${escapeHtml(item.name) || "—"}${item.qty ? " × " + escapeHtml(item.qty) : ""}</li>`).join("")}</ul>`
        : "";

    return `
      <h1>Shower Plan Assistant — დატვირთვის სია</h1>
      <p>${escapeHtml(state.loading.title) || "დატვირთვის სია"}</p>
      ${section("დუშთასეები", simpleListHtml(state.loading.trays, "დუშთასე"))}
      ${section("შუშები", simpleListHtml(state.loading.glass, "შუშა"))}
      ${section("კარები", simpleListHtml(state.loading.doors, "კარი"))}
      ${section("პანელები", qtyListHtml(state.loading.panels))}
      ${section("სხვა", qtyListHtml(state.loading.extras))}
    `;
  }

  function isAndroidDevice() {
    return /Android/i.test(navigator.userAgent || "");
  }

  function buildStandaloneLoadingDocument() {
    return `<!doctype html>
<html lang="ka">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Shower Plan Assistant — დატვირთვა PDF</title>
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
    h2 { margin: 0 0 4px; font-size: 12px; color: #0e5c56; border-bottom: 1px solid #d9e1df; padding-bottom: 3px; }
    p { margin: 1px 0; font-size: 10.5px; }
    ul { margin: 3px 0 0 14px; padding: 0; font-size: 10.5px; }
    .print-actions { position: sticky; top: 0; display: flex; justify-content: flex-end; padding: 0 0 10px; background: #fff; }
    .print-actions button { border: 1px solid #cfd9d6; border-radius: 8px; background: #0e5c56; color: #fff; padding: 10px 14px; font: inherit; font-weight: 800; }
    @media print { body { padding: 0; } .print-actions { display: none; } }
  </style>
</head>
<body>
  <div class="print-actions"><button onclick="window.print()">Save as PDF</button></div>
  <article class="printable-report">${buildPrintableLoadingContent()}</article>
  <script>
    window.addEventListener("load", () => setTimeout(() => window.print(), 600));
  <\/script>
</body>
</html>`;
  }

  function exportLoadingPdf() {
    if (isAndroidDevice()) {
      const popup = window.open("", "_blank");
      if (!popup) {
        showAlert("Android-ზე PDF-სთვის popup უნდა გაიხსნას. ბრაუზერში popup დაუშვი ან სცადე თავიდან.", "warn");
        return;
      }
      popup.document.open();
      popup.document.write(buildStandaloneLoadingDocument());
      popup.document.close();
      return;
    }

    const previousReport = document.querySelector(".printable-report");
    if (previousReport) previousReport.remove();

    const report = document.createElement("article");
    report.className = "printable-report";
    report.innerHTML = buildPrintableLoadingContent();
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

  // ---- Events ----

  function bindEvents() {
    els.titleInput.addEventListener("input", (event) => {
      state.loading.title = event.target.value;
      els.titleLabel.textContent = event.target.value || "ახალი დატვირთვა";
      clearAlert();
    });

    document.querySelectorAll(".add-item-btn[data-add]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const listName = btn.dataset.add;
        if (SIMPLE_LISTS.includes(listName)) {
          state.loading[listName].push(newSimpleItem());
          renderSimpleList(listName);
        } else if (QTY_LISTS.includes(listName)) {
          state.loading[listName].push(newQtyItem());
          renderQtyList(listName);
        }
        clearAlert();
      });
    });

    els.clearBtn.addEventListener("click", () => {
      state.loading = createEmptyLoading();
      renderAll();
      clearAlert();
    });

    els.saveBtn.addEventListener("click", saveCurrentLoading);
    els.exportBtn.addEventListener("click", exportLoadingPdf);

    els.clearHistoryBtn?.addEventListener("click", async () => {
      await window.AppDB.clearRecords(window.AppDB.LOADING_STORE);
      await renderHistory();
      showAlert("ისტორია წაიშალა.", "info");
    });
  }

  function cacheEls() {
    els.titleInput = $("#loadingTitleInput");
    els.titleLabel = $("#loadingTitleLabel");
    els.containers = {
      trays: $("#trayItems"),
      glass: $("#glassItems"),
      doors: $("#doorItems"),
      panels: $("#panelItems"),
      extras: $("#extraItems")
    };
    els.clearBtn = $("#loadingClearBtn");
    els.saveBtn = $("#loadingSaveBtn");
    els.exportBtn = $("#loadingExportBtn");
    els.clearHistoryBtn = $("#loadingClearHistoryBtn");
    els.historyList = $("#loadingHistoryList");
    els.alertBox = $("#loadingAlertBox");
  }

  async function init() {
    if (initialized) return;
    initialized = true;
    cacheEls();
    bindEvents();
    renderAll();
    await renderHistory();
  }

  window.LoadingMode = {
    init,
    onShow() {}
  };
})();
