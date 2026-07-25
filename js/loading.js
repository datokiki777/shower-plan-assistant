(function () {
  const $ = (selector) => document.querySelector(selector);

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
      customLists: []
    };
  }

  function newTray() {
    return { id: crypto.randomUUID(), note: "", checked: false };
  }
  function newGlass() {
    return { id: crypto.randomUUID(), note: "", door: "", checked: false };
  }
  function newPanel() {
    return { id: crypto.randomUUID(), name: "", qty: "", checked: false };
  }
  function newCustomItem() {
    return { id: crypto.randomUUID(), name: "", qty: "", checked: false };
  }
  function newCustomList(title) {
    return { id: crypto.randomUUID(), title: title || "ახალი სია", items: [] };
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
    renderPanels();
    renderCustomLists();
  }

  function renderTrays() {
    const container = els.trayItems;
    container.innerHTML = "";
    state.loading.trays.forEach((item, index) => {
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
        state.loading.trays.splice(index, 1);
        renderTrays();
        clearAlert();
      });
      container.appendChild(row);
    });
    if (!state.loading.trays.length) {
      container.innerHTML = '<p class="loading-empty">სია ცარიელია</p>';
    }
  }

  function renderGlass() {
    const container = els.glassItems;
    container.innerHTML = "";
    state.loading.glass.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "loading-item-row loading-item-row-glass";
      row.innerHTML = `
        <span class="loading-item-num">${index + 1}</span>
        <input type="checkbox" class="loading-check" ${item.checked ? "checked" : ""} />
        <input type="text" class="loading-note" placeholder="შენიშვნა (არასავალდებულო)" value="${escapeHtml(item.note)}" />
        <input type="text" class="loading-door" placeholder="კარი" value="${escapeHtml(item.door)}" />
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
        state.loading.glass.splice(index, 1);
        renderGlass();
        clearAlert();
      });
      container.appendChild(row);
    });
    if (!state.loading.glass.length) {
      container.innerHTML = '<p class="loading-empty">სია ცარიელია</p>';
    }
  }

  function renderPanels() {
    const container = els.panelItems;
    container.innerHTML = "";
    state.loading.panels.forEach((item, index) => {
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
        state.loading.panels.splice(index, 1);
        renderPanels();
        clearAlert();
      });
      container.appendChild(row);
    });
    if (!state.loading.panels.length) {
      container.innerHTML = '<p class="loading-empty">სია ცარიელია</p>';
    }
  }

  function renderCustomLists() {
    const container = els.customLists;
    container.innerHTML = "";
    state.loading.customLists.forEach((list, listIndex) => {
      const card = document.createElement("div");
      card.className = "custom-list-block";
      card.innerHTML = `
        <div class="custom-list-head">
          <input type="text" class="custom-list-title" value="${escapeHtml(list.title)}" placeholder="სიის დასახელება" />
          <button type="button" class="add-item-btn custom-add-item-btn">+ დამატება</button>
          <button type="button" class="danger-action custom-remove-list-btn">სიის წაშლა</button>
        </div>
        <div class="loading-items custom-items"></div>
      `;
      card.querySelector(".custom-list-title").addEventListener("input", (event) => {
        list.title = event.target.value;
        clearAlert();
      });
      card.querySelector(".custom-remove-list-btn").addEventListener("click", () => {
        state.loading.customLists.splice(listIndex, 1);
        renderCustomLists();
        clearAlert();
      });
      const itemsContainer = card.querySelector(".custom-items");
      const renderCustomItems = () => {
        itemsContainer.innerHTML = "";
        list.items.forEach((item, itemIndex) => {
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
            list.items.splice(itemIndex, 1);
            renderCustomItems();
            clearAlert();
          });
          itemsContainer.appendChild(row);
        });
        if (!list.items.length) {
          itemsContainer.innerHTML = '<p class="loading-empty">სია ცარიელია</p>';
        }
      };
      card.querySelector(".custom-add-item-btn").addEventListener("click", () => {
        list.items.push(newCustomItem());
        renderCustomItems();
        clearAlert();
      });
      renderCustomItems();
      container.appendChild(card);
    });
  }

  // ---- Persistence ----

  function hasAnyContent(loading) {
    return Boolean(
      (loading.trays && loading.trays.length) ||
      (loading.glass && loading.glass.length) ||
      (loading.panels && loading.panels.length) ||
      (loading.customLists && loading.customLists.some((list) => list.items.length))
    );
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

    const trayList = state.loading.trays.length
      ? `<ul>${state.loading.trays.map((item, i) => `<li>${checkMark(item.checked)} ${i + 1}. ${escapeHtml(item.note) || "დუშთასე " + (i + 1)}</li>`).join("")}</ul>`
      : "";

    const glassList = state.loading.glass.length
      ? `<ul>${state.loading.glass.map((item, i) => {
          const doorPart = item.door ? ` — კარი: ${escapeHtml(item.door)}` : "";
          return `<li>${checkMark(item.checked)} ${i + 1}. ${escapeHtml(item.note) || "შუშა " + (i + 1)}${doorPart}</li>`;
        }).join("")}</ul>`
      : "";

    const panelList = state.loading.panels.length
      ? `<ul>${state.loading.panels.map((item) => `<li>${checkMark(item.checked)} ${escapeHtml(item.name) || "—"}${item.qty ? " × " + escapeHtml(item.qty) : ""}</li>`).join("")}</ul>`
      : "";

    const customSections = state.loading.customLists
      .filter((list) => list.items.length)
      .map((list) => section(list.title || "დამატებითი სია", `<ul>${list.items.map((item) => `<li>${checkMark(item.checked)} ${escapeHtml(item.name) || "—"}${item.qty ? " × " + escapeHtml(item.qty) : ""}</li>`).join("")}</ul>`))
      .join("");

    return `
      <h1>Shower Plan Assistant — დატვირთვის სია</h1>
      <p>${escapeHtml(state.loading.title) || "დატვირთვის სია"}</p>
      ${section("დუშთასეები", trayList)}
      ${section("შუშები", glassList)}
      ${section("პანელები", panelList)}
      ${customSections}
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
        if (listName === "trays") state.loading.trays.push(newTray());
        if (listName === "glass") state.loading.glass.push(newGlass());
        if (listName === "panels") state.loading.panels.push(newPanel());
        renderAll();
        clearAlert();
      });
    });

    els.addCustomListBtn.addEventListener("click", () => {
      state.loading.customLists.push(newCustomList(`სია ${state.loading.customLists.length + 1}`));
      renderCustomLists();
      clearAlert();
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
    els.trayItems = $("#trayItems");
    els.glassItems = $("#glassItems");
    els.panelItems = $("#panelItems");
    els.customLists = $("#customLists");
    els.addCustomListBtn = $("#addCustomListBtn");
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
    onShow() {
      // Views are re-rendered on every change already; nothing extra needed on show.
    }
  };
})();
