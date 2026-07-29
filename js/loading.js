(function () {
  const $ = (selector) => document.querySelector(selector);

  const ORDINALS = [
    "პირველი", "მეორე", "მესამე", "მეოთხე", "მეხუთე",
    "მეექვსე", "მეშვიდე", "მერვე", "მეცხრე", "მეათე",
    "მეთერთმეტე", "მეთორმეტე", "მეცამეტე", "მეთოთხმეტე", "მეთხუთმეტე",
    "მეთექვსმეტე", "მეჩვიდმეტე", "მეთვრამეტე", "მეცხრამეტე", "მეოცე"
  ];
  function ordinalWord(n) {
    return ORDINALS[n - 1] || `${n}-ე`;
  }

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
      panels: [],
      extras: []
    };
  }

  function newTrayItem() {
    return { id: crypto.randomUUID(), note: "", checked: false };
  }
  function newGlassItem() {
    return { id: crypto.randomUUID(), note: "", door: "", checked: false };
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
    renderTrays();
    renderGlass();
    renderQtyList("panels");
    renderQtyList("extras");
  }

  function renderTrays() {
    const container = els.containers.trays;
    const items = state.loading.trays;
    container.innerHTML = "";
    items.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "loading-item-row";
      row.innerHTML = `
        <span class="loading-item-num">${index + 1}</span>
        <input type="checkbox" class="loading-check" ${item.checked ? "checked" : ""} />
        <input type="text" class="loading-note" placeholder="${escapeHtml(ordinalWord(index + 1))}" value="${escapeHtml(item.note)}" />
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
        renderTrays();
        clearAlert();
      });
      container.appendChild(row);
    });
    if (!items.length) {
      container.innerHTML = '<p class="loading-empty">სია ცარიელია</p>';
    }
  }

  function renderGlass() {
    const container = els.containers.glass;
    const items = state.loading.glass;
    container.innerHTML = "";
    items.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "loading-item-row loading-item-row-glass";
      row.innerHTML = `
        <span class="loading-item-num">${index + 1}</span>
        <input type="checkbox" class="loading-check" ${item.checked ? "checked" : ""} />
        <input type="text" class="loading-note" placeholder="${escapeHtml(ordinalWord(index + 1))}" value="${escapeHtml(item.note)}" />
        <input type="text" class="loading-door" placeholder="კარი (არასავალდებულო)" value="${escapeHtml(item.door)}" />
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
      row.querySelector(".loading-door").addEventListener("input", (event) => {
        item.door = event.target.value;
        clearAlert();
      });
      row.querySelector(".loading-remove-btn").addEventListener("click", () => {
        items.splice(index, 1);
        renderGlass();
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
    return ["trays", "glass", "panels", "extras"].some((key) => loading[key] && loading[key].length);
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

    const trayListHtml = state.loading.trays.length
      ? `<ul>${state.loading.trays.map((item, i) => `<li>${i + 1}. ${escapeHtml(item.note.trim()) || escapeHtml(ordinalWord(i + 1))}</li>`).join("")}</ul>`
      : "";

    const glassListHtml = state.loading.glass.length
      ? `<ul>${state.loading.glass
          .map((item, i) => {
            const noteTrim = item.note.trim();
            const doorTrim = item.door.trim();
            const parts = [];
            if (noteTrim) parts.push(escapeHtml(noteTrim));
            if (doorTrim) parts.push(`კარი: ${escapeHtml(doorTrim)}`);
            const text = parts.length ? parts.join(" — ") : escapeHtml(ordinalWord(i + 1));
            return `<li>${i + 1}. ${text}</li>`;
          })
          .join("")}</ul>`
      : "";

    const qtyListHtml = (items) =>
      items.length
        ? `<ul>${items.map((item) => `<li>${escapeHtml(item.name) || "—"}${item.qty ? " × " + escapeHtml(item.qty) : ""}</li>`).join("")}</ul>`
        : "";

    return `
      <h1>Shower Plan Assistant — დატვირთვის სია</h1>
      <p>${escapeHtml(state.loading.title) || "დატვირთვის სია"}</p>
      ${section("დუშთასეები", trayListHtml)}
      ${section("შუშები (+ კარი)", glassListHtml)}
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

  async function generateLoadingImageBlob() {
    if (!window.html2canvas) throw new Error("html2canvas ვერ ჩაიტვირთა");
    const wrapper = document.createElement("div");
    wrapper.className = "printable-report share-capture";
    wrapper.innerHTML = buildPrintableLoadingContent();
    document.body.appendChild(wrapper);
    await new Promise((resolve) => window.setTimeout(resolve, 60));
    try {
      const canvas = await window.html2canvas(wrapper, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
      return await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    } finally {
      wrapper.remove();
    }
  }

  async function shareLoading() {
    clearAlert();
    if (!hasAnyContent(state.loading)) {
      showAlert("სია ცარიელია, დაამატე მინიმუმ ერთი ჩანაწერი გაზიარებამდე.", "warn");
      return;
    }
    if (els.shareBtn) els.shareBtn.disabled = true;
    try {
      const blob = await generateLoadingImageBlob();
      if (!blob) throw new Error("სურათი ვერ შეიქმნა");
      const fileName = `${(state.loading.title || "datvirtvis-sia").replace(/\s+/g, "_")}.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: state.loading.title || "დატვირთვის სია" });
        showAlert("გაზიარება გაიხსნა.", "ok");
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showAlert("სურათი ჩამოიტვირთა. ეს მოწყობილობა/ბრაუზერი პირდაპირ გაზიარებას ვერ უჭერს მხარს.", "warn");
    } catch (error) {
      if (error?.name !== "AbortError") showAlert("გაზიარება ვერ განხორციელდა, სცადე თავიდან.", "warn");
    } finally {
      if (els.shareBtn) els.shareBtn.disabled = false;
    }
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
        if (listName === "trays") {
          state.loading.trays.push(newTrayItem());
          renderTrays();
        } else if (listName === "glass") {
          state.loading.glass.push(newGlassItem());
          renderGlass();
        } else if (listName === "panels" || listName === "extras") {
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
    els.shareBtn?.addEventListener("click", shareLoading);

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
      panels: $("#panelItems"),
      extras: $("#extraItems")
    };
    els.clearBtn = $("#loadingClearBtn");
    els.saveBtn = $("#loadingSaveBtn");
    els.exportBtn = $("#loadingExportBtn");
    els.shareBtn = $("#loadingShareBtn");
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
