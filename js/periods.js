(function () {
  const $ = (selector) => document.querySelector(selector);

  const els = {};
  let workers = [];
  let initialized = false;

  const DAY = 86400000;

  function parseDate(value) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  function iso(date) {
    return date.toISOString().slice(0, 10);
  }
  function addDays(value, n) {
    const d = typeof value === "string" ? parseDate(value) : new Date(value);
    return iso(new Date(d.getTime() + n * DAY));
  }
  function diffDays(a, b) {
    return Math.round((parseDate(b) - parseDate(a)) / DAY);
  }
  function today() {
    return iso(new Date());
  }
  function formatDate(value) {
    if (!value) return "—";
    return new Intl.DateTimeFormat("ka-GE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
      parseDate(value)
    );
  }
  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
  function initials(name) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((x) => x[0])
      .join("")
      .toUpperCase();
  }

  // ---- 90/180-day rule math (unchanged from the original EES app) ----

  function normalizedStays(worker, excludeStayId = null) {
    return worker.stays
      .filter((s) => s.id !== excludeStayId)
      .map((s) => ({ entry: s.entry, exit: s.exit || today() }));
  }
  function isPresent(date, stays) {
    return stays.some((s) => date >= s.entry && date <= s.exit);
  }
  function usedInWindow(endDate, stays) {
    let used = 0;
    for (let i = 0; i < 180; i++) if (isPresent(addDays(endDate, -i), stays)) used++;
    return used;
  }
  function maxDeparture(worker, stay) {
    const historical = normalizedStays(worker, stay.id);
    let lastAllowed = addDays(stay.entry, -1);
    for (let i = 0; i < 370; i++) {
      const candidate = addDays(stay.entry, i);
      const proposed = [...historical, { entry: stay.entry, exit: candidate }];
      if (i >= 90 || usedInWindow(candidate, proposed) > 90) break;
      lastAllowed = candidate;
    }
    return lastAllowed;
  }
  function earliestReturn(worker, exitDate) {
    const stays = normalizedStays(worker).map((s) => (s.exit > exitDate ? { ...s, exit: exitDate } : s));
    let candidate = addDays(exitDate, 91);
    for (let i = 0; i < 370; i++) {
      const day = addDays(candidate, i);
      if (usedInWindow(day, [...stays, { entry: day, exit: day }]) <= 90) return day;
    }
    return candidate;
  }
  function activeStay(worker) {
    return worker.stays.find((s) => !s.exit);
  }
  function currentInfo(worker) {
    const active = activeStay(worker);
    if (active) {
      const max = maxDeparture(worker, active);
      const elapsed = Math.max(0, diffDays(active.entry, today()) + 1);
      const unused = Math.max(0, diffDays(today(), max));
      return { inside: true, active, max, back: earliestReturn(worker, max), elapsed, remaining: unused, unused };
    }
    const last = [...worker.stays].filter((s) => s.exit).sort((a, b) => b.exit.localeCompare(a.exit))[0];
    const lastMax = last ? maxDeparture(worker, last) : null;
    const unused = last && last.exit <= lastMax ? Math.max(0, diffDays(last.exit, lastMax)) : 0;
    return { inside: false, last, back: last ? earliestReturn(worker, last.exit) : null, elapsed: 0, remaining: null, unused };
  }

  // ---- Storage (shared IndexedDB / service worker via window.AppDB) ----

  const putWorker = (worker) => window.AppDB.putRecord(window.AppDB.PERIODS_STORE, worker);
  const getAllWorkers = () => window.AppDB.getRecords(window.AppDB.PERIODS_STORE);
  const removeWorker = (id) => window.AppDB.deleteRecord(window.AppDB.PERIODS_STORE, id);
  const clearWorkers = () => window.AppDB.clearRecords(window.AppDB.PERIODS_STORE);

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

  // ---- Rendering ----

  function render() {
    const query = (els.search.value || "").trim().toLocaleLowerCase("ka");
    const ordered = [...workers].sort((a, b) => {
      const ai = !!activeStay(a);
      const bi = !!activeStay(b);
      return (bi ? 1 : 0) - (ai ? 1 : 0) || a.name.localeCompare(b.name, "ka");
    });
    const visible = ordered.filter((w) => w.name.toLocaleLowerCase("ka").includes(query));

    els.total.textContent = workers.length;
    els.inside.textContent = workers.filter((w) => activeStay(w)).length;
    els.urgent.textContent = workers.filter((w) => {
      const info = currentInfo(w);
      return info.inside && info.remaining <= 14;
    }).length;
    els.empty.hidden = workers.length > 0 || query.length > 0;

    els.list.innerHTML = visible
      .map((w) => {
        const info = currentInfo(w);
        const actionBtn = info.inside
          ? `<button class="primary" data-periods-action="exit" data-periods-id="${escapeHtml(w.id)}">გასვლა</button>`
          : `<button class="primary" data-periods-action="entry" data-periods-id="${escapeHtml(w.id)}">შესვლა</button>`;
        const first = info.inside ? info.active.entry : info.last?.entry || null;
        const exit = info.inside ? info.max : info.last?.exit || null;
        const used = Math.min(90, info.elapsed);
        return `<article class="periods-worker-card"><div class="periods-worker-main">
          <div class="periods-person"><div class="periods-avatar">${escapeHtml(initials(w.name))}</div><div><h3>${escapeHtml(w.name)}</h3><span class="periods-status ${info.inside ? "" : "out"}">${info.inside ? "● ქვეყანაშია" : "○ გასულია"}</span></div></div>
          <div class="periods-datum"><span>${info.inside ? "შემოვიდა" : "ბოლო შემოსვლა"}</span><strong>${formatDate(first)}</strong></div>
          <div class="periods-datum periods-datum-depart"><span>${info.inside ? "მაქს. გასვლა" : "გავიდა"}</span><strong>${formatDate(exit)}</strong></div>
          <div class="periods-datum periods-datum-return"><span>დაბრუნება შეუძლია</span><strong>${formatDate(info.back)}</strong></div>
          <div class="periods-actions">${actionBtn}<button class="icon-action" title="წაშლა" data-periods-action="delete" data-periods-id="${escapeHtml(w.id)}">🗑</button></div>
        </div><div class="periods-card-footer"><button class="text-btn-periods" data-periods-action="history" data-periods-id="${escapeHtml(w.id)}">ისტორია · ${w.stays.length} პერიოდი</button>${
          info.inside
            ? `<div class="periods-progress"><i class="${used >= 76 ? "warn" : ""}" style="width:${(used / 90) * 100}%"></i></div><span>${used} დღე გამოყენებულია · <b>${info.unused} დღე დარჩა</b></span>`
            : `<span>ქვეყნის გარეთ · <b>${info.unused} დღე დარჩა გამოუყენებელი</b></span>`
        }</div></article>`;
      })
      .join("");
  }

  function openWorker(workerId = "") {
    const worker = workers.find((w) => w.id === workerId);
    $("#periodsWorkerId").value = workerId;
    $("#periodsWorkerName").value = worker?.name || "";
    $("#periodsWorkerName").readOnly = !!worker;
    $("#periodsEntryDate").value = today();
    $("#periodsWorkerDialogTitle").textContent = worker ? `${worker.name} — შესვლა` : "პიროვნების დამატება";
    els.workerDialog.showModal();
  }

  function closeDialogs() {
    [els.workerDialog, els.exitDialog, els.historyDialog].forEach((d) => {
      if (d?.open) d.close();
    });
  }

  function showHistory(id) {
    const worker = workers.find((w) => w.id === id);
    if (!worker) return;
    $("#periodsHistoryWorkerName").textContent = worker.name;
    $("#periodsHistoryList").innerHTML = [...worker.stays]
      .sort((a, b) => b.entry.localeCompare(a.entry))
      .map(
        (s) => `<div class="periods-history-row"><div><span>შემოსვლა</span><strong>${formatDate(s.entry)}</strong></div><div><span>გასვლა</span><strong>${s.exit ? formatDate(s.exit) : "ჯერ ქვეყანაშია"}</strong></div><strong>${s.exit ? diffDays(s.entry, s.exit) + 1 : diffDays(s.entry, today()) + 1} დღე</strong></div>`
      )
      .join("");
    els.historyDialog.showModal();
  }

  // ---- Events ----

  function bindEvents() {
    els.workerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const id = $("#periodsWorkerId").value;
      const entry = $("#periodsEntryDate").value;
      const name = $("#periodsWorkerName").value.trim();
      if (!name || !entry) return;
      let worker = workers.find((w) => w.id === id);
      if (worker) {
        const last = worker.stays.filter((s) => s.exit).sort((a, b) => b.exit.localeCompare(a.exit))[0];
        if (last && entry < earliestReturn(worker, last.exit)) {
          showAlert(`დაბრუნება შესაძლებელია ${formatDate(earliestReturn(worker, last.exit))}-დან`, "warn");
          return;
        }
        worker.stays.push({ id: crypto.randomUUID(), entry, exit: null });
      } else {
        worker = { id: crypto.randomUUID(), name, createdAt: new Date().toISOString(), stays: [{ id: crypto.randomUUID(), entry, exit: null }] };
        workers.push(worker);
      }
      await putWorker(worker);
      closeDialogs();
      render();
      showAlert("ჩანაწერი შენახულია.", "ok");
    });

    els.exitForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const worker = workers.find((w) => w.id === $("#periodsExitWorkerId").value);
      const stay = worker?.stays.find((s) => s.id === $("#periodsExitStayId").value);
      const date = $("#periodsExitDate").value;
      if (!stay) return;
      const max = maxDeparture(worker, stay);
      if (date < stay.entry || date > max) {
        showAlert(`გასვლა უნდა იყოს ${formatDate(stay.entry)}–${formatDate(max)}`, "warn");
        return;
      }
      stay.exit = date;
      await putWorker(worker);
      closeDialogs();
      render();
      showAlert("გასვლა დაფიქსირდა.", "ok");
    });

    els.list.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-periods-action]");
      if (!button) return;
      const { periodsAction: action, periodsId: id } = button.dataset;
      if (action === "entry") openWorker(id);
      if (action === "exit") {
        const worker = workers.find((w) => w.id === id);
        const stay = activeStay(worker);
        const max = maxDeparture(worker, stay);
        $("#periodsExitWorkerId").value = id;
        $("#periodsExitStayId").value = stay.id;
        $("#periodsExitWorkerName").textContent = worker.name;
        $("#periodsExitDate").min = stay.entry;
        $("#periodsExitDate").max = max;
        $("#periodsExitDate").value = today() > max ? max : today() < stay.entry ? stay.entry : today();
        els.exitDialog.showModal();
      }
      if (action === "delete") {
        const worker = workers.find((w) => w.id === id);
        if (worker && window.confirm(`წაიშალოს ${worker.name} და მისი სრული ისტორია?`)) {
          await removeWorker(id);
          workers = workers.filter((w) => w.id !== id);
          render();
          showAlert("პიროვნება წაიშალა.", "info");
        }
      }
      if (action === "history") showHistory(id);
    });

    document.addEventListener("click", (event) => {
      const closeBtn = event.target.closest("[data-periods-close]");
      if (closeBtn) closeBtn.closest("dialog")?.close();
    });

    els.addBtn.addEventListener("click", () => openWorker());
    els.search.addEventListener("input", render);

    els.backupBtn.addEventListener("click", () => {
      const payload = { app: "EES", version: 1, exportedAt: new Date().toISOString(), workers };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `periodebi-backup-${today()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      showAlert("Backup ფაილი შეიქმნა.", "ok");
    });

    els.restoreBtn.addEventListener("click", () => els.restoreInput.click());
    els.restoreInput.addEventListener("change", async (event) => {
      try {
        const file = event.target.files[0];
        const data = JSON.parse(await file.text());
        if (data.app !== "EES" || !Array.isArray(data.workers)) throw new Error("invalid backup file");
        if (!window.confirm(`Restore ჩაანაცვლებს მიმდინარე ${workers.length} ჩანაწერს. გავაგრძელოთ?`)) return;
        await clearWorkers();
        workers = data.workers;
        for (const w of workers) await putWorker(w);
        render();
        showAlert("მონაცემები აღდგენილია.", "ok");
      } catch {
        showAlert("JSON ფაილი არასწორია.", "warn");
      } finally {
        event.target.value = "";
      }
    });
  }

  function cacheEls() {
    els.list = $("#periodsWorkerList");
    els.empty = $("#periodsEmptyState");
    els.total = $("#periodsTotalCount");
    els.inside = $("#periodsInsideCount");
    els.urgent = $("#periodsUrgentCount");
    els.search = $("#periodsSearchInput");
    els.workerDialog = $("#periodsWorkerDialog");
    els.workerForm = $("#periodsWorkerForm");
    els.exitDialog = $("#periodsExitDialog");
    els.exitForm = $("#periodsExitForm");
    els.historyDialog = $("#periodsHistoryDialog");
    els.alertBox = $("#periodsAlertBox");
    els.addBtn = $("#periodsAddBtn");
    els.backupBtn = $("#periodsBackupBtn");
    els.restoreBtn = $("#periodsRestoreBtn");
    els.restoreInput = $("#periodsRestoreInput");
  }

  async function init() {
    if (initialized) return;
    initialized = true;
    cacheEls();
    bindEvents();
    try {
      workers = await getAllWorkers();
    } catch (err) {
      console.error(err);
      showAlert("მონაცემთა ბაზა ვერ გაიხსნა.", "warn");
    }
    render();
    clearAlert();
  }

  window.PeriodsMode = {
    init,
    onShow() {}
  };
})();
