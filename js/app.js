const DB_NAME = "shower-plan-assistant";
const DB_VERSION = 5;
const STORE = "reports";
const LOADING_STORE = "loadingLists";
const GROUP_STORE = "groups";
const PERIODS_STORE = "periodsWorkers";
const TEMPLATE_STORE = "fieldTemplates";
const TEMPLATE_FIELDS = [
  "packageType",
  "antiSlip",
  "showerTraySize",
  "glassPartitionSize",
  "hingedDoorSize",
  "panelColor",
  "floorPanelColor",
  "panelHeight",
  "installables"
];
const TEMPLATE_FIELD_LABELS = {
  packageType: "პაკეტი",
  antiSlip: "ანტირუჩი",
  showerTraySize: "დუშთასეს ზომა",
  glassPartitionSize: "შუშის ზომა",
  hingedDoorSize: "კარი",
  panelColor: "პანელის ფერი",
  floorPanelColor: "იატაკის პანელის ფერი",
  panelHeight: "პანელი სადამდე კეთდება",
  installables: "დასაყენებლების სია"
};
const TEMPLATE_APPEND_FIELDS = new Set(["glassPartitionSize", "installables"]);

const fields = [
  "clientName",
  "address",
  "phone",
  "googleMapsLink",
  "jobDate",
  "jobDurationDays",
  "groupId",
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
  report: createEmptyReport(),
  groups: [],
  openGroupIds: new Set(),
  openHistoryGroupIds: new Set(),
  templates: {}
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
  removeSketchBtn: $("#removeSketchBtn"),
  modeReportBtn: $("#modeReportBtn"),
  modeLoadingBtn: $("#modeLoadingBtn"),
  modePeriodsBtn: $("#modePeriodsBtn"),
  reportView: $("#reportView"),
  loadingView: $("#loadingView"),
  periodsView: $("#periodsView"),
  updateDialog: $("#updateDialog"),
  updateYesBtn: $("#updateYesBtn"),
  updateNoBtn: $("#updateNoBtn"),
  groupSelect: $("#groupSelect"),
  newGroupInput: $("#newGroupInput"),
  addGroupBtn: $("#addGroupBtn"),
  groupsList: $("#groupsList"),
  reportToolbar: $("#reportToolbar"),
  reportToggleBtn: $("#reportToggleBtn"),
  reportBody: $("#reportBody"),
  templatesToolbar: $("#templatesToolbar"),
  templatesToggleBtn: $("#templatesToggleBtn"),
  templatesBody: $("#templatesBody"),
  templatesFieldsList: $("#templatesFieldsList")
};

const MODE_STORAGE_KEY = "shower-plan-assistant-mode";

function setReportBodyOpen(open) {
  if (!els.reportBody || !els.reportToolbar) return;
  els.reportBody.hidden = !open;
  els.reportToolbar.classList.toggle("is-open", open);
}

function bindSimpleToggle(toggleBtn, toolbar, body) {
  if (!toggleBtn || !toolbar || !body) return;
  toggleBtn.addEventListener("click", () => {
    const willOpen = body.hidden;
    body.hidden = !willOpen;
    toolbar.classList.toggle("is-open", willOpen);
  });
}

function setMode(mode, persist = true) {
  const validMode = ["report", "loading", "periods"].includes(mode) ? mode : "report";
  els.reportView.hidden = validMode !== "report";
  els.loadingView.hidden = validMode !== "loading";
  if (els.periodsView) els.periodsView.hidden = validMode !== "periods";
  els.modeReportBtn.classList.toggle("is-active", validMode === "report");
  els.modeLoadingBtn.classList.toggle("is-active", validMode === "loading");
  els.modePeriodsBtn?.classList.toggle("is-active", validMode === "periods");
  if (validMode === "loading") window.LoadingMode?.onShow();
  if (validMode === "periods") window.PeriodsMode?.onShow();
  if (persist) {
    try {
      localStorage.setItem(MODE_STORAGE_KEY, validMode);
    } catch {
      // localStorage unavailable (private mode etc.) - ignore, mode just won't persist.
    }
  }
}

function restoreMode() {
  let storedMode = "report";
  try {
    storedMode = localStorage.getItem(MODE_STORAGE_KEY) || "report";
  } catch {
    storedMode = "report";
  }
  setMode(storedMode, false);
}

function createEmptyReport() {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    clientName: "",
    address: "",
    phone: "",
    googleMapsLink: "",
    jobDate: "",
    jobDurationDays: "",
    groupId: "",
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
    sketch: null,
    archived: false
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
  report.archived = Boolean(payload.archived);
  fields.forEach((name) => {
    const isArrayField = Array.isArray(createEmptyReport()[name]);
    if (isArrayField && !Array.isArray(report[name])) report[name] = textToArray(report[name]);
    if (!isArrayField && report[name] == null) report[name] = "";
    if (isArrayField && !Array.isArray(report[name])) report[name] = [];
  });
  return report;
}

let dbPromise = null;
function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(LOADING_STORE)) db.createObjectStore(LOADING_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(GROUP_STORE)) db.createObjectStore(GROUP_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(PERIODS_STORE)) db.createObjectStore(PERIODS_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(TEMPLATE_STORE)) db.createObjectStore(TEMPLATE_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

async function putRecord(storeName, record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(record);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function getRecords(storeName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
    req.onerror = () => reject(req.error);
  });
}

async function clearRecords(storeName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteRecord(storeName, id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

const putReport = (report) => putRecord(STORE, report);
const getReports = () => getRecords(STORE);
const clearReports = () => clearRecords(STORE);

const putGroup = (group) => putRecord(GROUP_STORE, group);
const getGroups = () => getRecords(GROUP_STORE);
const deleteGroup = (id) => deleteRecord(GROUP_STORE, id);

function defaultTemplates() {
  const obj = {};
  TEMPLATE_FIELDS.forEach((f) => (obj[f] = []));
  return obj;
}

async function loadTemplates() {
  const records = await getRecords(TEMPLATE_STORE);
  const record = records[0];
  state.templates = { ...defaultTemplates(), ...(record || {}) };
  renderTemplatesPanel();
}

async function saveTemplates() {
  await putRecord(TEMPLATE_STORE, { id: "main", createdAt: new Date().toISOString(), ...state.templates });
}

window.AppDB = { putRecord, getRecords, clearRecords, deleteRecord, LOADING_STORE, PERIODS_STORE };

async function saveCurrentReport(showMessage = true) {
  syncReportFromForm();
  if (!state.report.groupId) {
    if (!state.groups.length) {
      showAlert("ჯერ ჯგუფი შექმენი (ზემოთ „+ ჯგუფი“), მერე შეინახავ კლიენტს.", "warn");
    } else {
      showAlert("აირჩიე ჯგუფი კლიენტისთვის შენახვამდე.", "warn");
    }
    return;
  }
  state.report.createdAt = new Date().toISOString();
  state.report.archived = false;
  await putReport(state.report);
  await renderHistory();
  await renderGroupsPanel();
  if (showMessage) showAlert("ანგარიში შენახულია ისტორიაში.", "ok");
}

async function renderHistory() {
  if (!els.historyList) return;
  const [groups, reports] = await Promise.all([getGroups(), getReports()]);
  const sortedGroups = [...groups].sort((a, b) => String(a.name).localeCompare(String(b.name), "ka"));
  const byGroup = new Map(sortedGroups.map((g) => [g.id, []]));
  const noGroup = [];
  reports.forEach((r) => {
    if (r.groupId && byGroup.has(r.groupId)) byGroup.get(r.groupId).push(r);
    else noGroup.push(r);
  });
  byGroup.forEach((list) => sortClientsByDate(list));
  sortClientsByDate(noGroup);

  if (!reports.length) {
    els.historyList.innerHTML = '<p class="loading-empty">ისტორია ცარიელია — შენახული კლიენტები აქ გამოჩნდება</p>';
    return;
  }

  const groupBlocks = sortedGroups
    .map((g) => renderCollapsibleGroupCard(g.id, g.name, byGroup.get(g.id) || [], state.openHistoryGroupIds, { deleteMode: "permanent" }))
    .join("");
  const noGroupBlock = noGroup.length
    ? renderCollapsibleGroupCard("__no_group__", "ჯგუფის გარეშე (ძველი ჩანაწერები)", noGroup, state.openHistoryGroupIds, {
        deleteMode: "permanent"
      })
    : "";

  els.historyList.innerHTML = groupBlocks + noGroupBlock;
}

async function loadGroups() {
  state.groups = await getGroups();
  renderGroupSelectOptions();
}

function renderGroupSelectOptions() {
  if (!els.groupSelect) return;
  const current = state.report.groupId || "";
  const sorted = [...state.groups].sort((a, b) => String(a.name).localeCompare(String(b.name), "ka"));
  els.groupSelect.innerHTML =
    '<option value="" disabled>— აირჩიე ჯგუფი —</option>' +
    sorted.map((g) => `<option value="${escapeHtml(g.id)}">${escapeHtml(g.name)}</option>`).join("");
  els.groupSelect.value = current;
}

function appendToTextareaField(fieldName, value) {
  const input = els.reportForm.elements[fieldName];
  if (!input) return;
  const current = input.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!current.includes(value)) current.push(value);
  input.value = current.join("\n");
  syncReportFromForm();
  clearAlert();
}

function openTemplatePicker(field) {
  const dialog = document.getElementById("templatePickerDialog");
  const titleEl = document.getElementById("templatePickerTitle");
  const hintEl = document.getElementById("templatePickerHint");
  const listEl = document.getElementById("templatePickerList");
  if (!dialog || !titleEl || !hintEl || !listEl) return;
  const isAppend = TEMPLATE_APPEND_FIELDS.has(field);
  titleEl.textContent = TEMPLATE_FIELD_LABELS[field] || "შაბლონები";
  hintEl.textContent = isAppend
    ? "დააჭირე ერთს ან რამდენიმეს — ყოველი ემატება ახალ ხაზად. დაასრულებ როცა დახურავ."
    : "აირჩიე შაბლონი — ჩაიწერება ველში, შემდეგ თუ გინდა შეგიძლია თავად გადააკეთო.";
  const values = state.templates[field] || [];
  listEl.dataset.field = field;
  listEl.innerHTML = values.length
    ? values
        .map((v) => `<button type="button" class="template-picker-option" data-value="${escapeHtml(v)}">${escapeHtml(v)}</button>`)
        .join("")
    : '<p class="loading-empty">შაბლონები ჯერ არ არის დამატებული — დაამატე „შაბლონები“ პანელში ზემოთ</p>';
  dialog.showModal();
}

function bindTemplatePickerEvents() {
  document.querySelectorAll(".template-picker-btn").forEach((btn) => {
    btn.addEventListener("click", () => openTemplatePicker(btn.dataset.templateField));
  });
  const listEl = document.getElementById("templatePickerList");
  listEl?.addEventListener("click", (event) => {
    const option = event.target.closest(".template-picker-option");
    if (!option) return;
    const field = listEl.dataset.field;
    const value = option.dataset.value;
    if (TEMPLATE_APPEND_FIELDS.has(field)) {
      appendToTextareaField(field, value);
      option.classList.add("is-picked");
    } else {
      const input = els.reportForm.elements[field];
      if (input) {
        input.value = value;
        syncReportFromForm();
        clearAlert();
      }
      document.getElementById("templatePickerDialog")?.close();
    }
  });
  document.getElementById("templatePickerCloseBtn")?.addEventListener("click", () => {
    document.getElementById("templatePickerDialog")?.close();
  });
}

function renderTemplatesPanel() {
  if (!els.templatesFieldsList) return;
  els.templatesFieldsList.innerHTML = TEMPLATE_FIELDS.map((field) => {
    const values = state.templates[field] || [];
    const chips = values.length
      ? values
          .map(
            (v) => `
        <span class="template-chip">
          ${escapeHtml(v)}
          <button type="button" data-remove-template-field="${field}" data-remove-template-value="${escapeHtml(v)}" aria-label="წაშლა">×</button>
        </span>`
          )
          .join("")
      : '<span class="loading-empty">შაბლონები ჯერ არ არის</span>';
    return `
      <div class="group-card">
        <div class="group-card-head">
          <strong>${escapeHtml(TEMPLATE_FIELD_LABELS[field] || field)}</strong>
          <span class="group-count">${values.length} შაბლონი</span>
        </div>
        <div class="template-chip-list">${chips}</div>
        <div class="add-group-row">
          <input type="text" data-template-add-input="${field}" placeholder="ახალი შაბლონის დამატება" />
          <button type="button" data-template-add-btn="${field}">+ დამატება</button>
        </div>
      </div>`;
  }).join("");
}

async function addTemplateValue(field, rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return;
  const list = state.templates[field] || (state.templates[field] = []);
  if (list.includes(value)) {
    showAlert("ეს შაბლონი უკვე დამატებულია.", "warn");
    return;
  }
  list.push(value);
  await saveTemplates();
  renderTemplatesPanel();
}

async function removeTemplateValue(field, value) {
  state.templates[field] = (state.templates[field] || []).filter((v) => v !== value);
  await saveTemplates();
  renderTemplatesPanel();
}

function bindTemplatesPanelEvents() {
  els.templatesFieldsList?.addEventListener("click", (event) => {
    const addBtn = event.target.closest("[data-template-add-btn]");
    if (addBtn) {
      const field = addBtn.dataset.templateAddBtn;
      const input = els.templatesFieldsList.querySelector(`[data-template-add-input="${field}"]`);
      addTemplateValue(field, input?.value);
      if (input) input.value = "";
      return;
    }
    const removeBtn = event.target.closest("[data-remove-template-field]");
    if (removeBtn) {
      removeTemplateValue(removeBtn.dataset.removeTemplateField, removeBtn.dataset.removeTemplateValue);
    }
  });
  els.templatesFieldsList?.addEventListener("keydown", (event) => {
    const input = event.target.closest("[data-template-add-input]");
    if (input && event.key === "Enter") {
      event.preventDefault();
      const field = input.dataset.templateAddInput;
      addTemplateValue(field, input.value);
      input.value = "";
    }
  });
}


async function addGroup() {
  const name = (els.newGroupInput?.value || "").trim();
  if (!name) {
    showAlert("ჯგუფის დასახელება ცარიელია.", "warn");
    return;
  }
  const group = { id: crypto.randomUUID(), name, createdAt: new Date().toISOString() };
  await putGroup(group);
  els.newGroupInput.value = "";
  await loadGroups();
  await renderGroupsPanel();
  showAlert(`ჯგუფი „${name}“ დაემატა.`, "ok");
}

async function renameGroupPrompt(group) {
  const nextName = window.prompt("ჯგუფის ახალი დასახელება:", group.name);
  if (nextName == null) return;
  const trimmed = nextName.trim();
  if (!trimmed) return;
  await putGroup({ ...group, name: trimmed });
  await loadGroups();
  await renderGroupsPanel();
}

async function removeGroup(group) {
  const clientsInGroup = (await getReports()).filter((r) => r.groupId === group.id);
  const message = clientsInGroup.length
    ? `ჯგუფი „${group.name}“ შეიცავს ${clientsInGroup.length} კლიენტს. ჯგუფის წაშლა წაშლის ამ კლიენტებსაც. დარწმუნებული ხარ?`
    : `წავშალო ჯგუფი „${group.name}“?`;
  if (!(await showConfirm(message, { title: "ჯგუფის წაშლა" }))) return;
  await Promise.all(clientsInGroup.map((r) => deleteRecord(STORE, r.id)));
  await deleteGroup(group.id);
  await loadGroups();
  if (state.report.groupId === group.id) {
    state.report.groupId = "";
    renderGroupSelectOptions();
  }
  await renderHistory();
  await renderGroupsPanel();
}

async function archiveClientReport(report) {
  const confirmed = await showConfirm(
    `„${report.clientName || "უსახელო"}“ მოიხსნება აქტიური ჯგუფიდან და გადავა ისტორიაში. თუ კვლავ დაგჭირდება, ისტორიიდან ჩატვირთვა და შენახვა დააბრუნებს აქტიურ სამუშაოში. გავაგრძელოთ?`,
    { title: "წაშლა ჯგუფიდან" }
  );
  if (!confirmed) return;
  const archived = { ...report, archived: true };
  await putReport(archived);
  if (state.report.id === report.id) state.report.archived = true;
  await renderHistory();
  await renderGroupsPanel();
  showAlert("კლიენტი ჯგუფიდან მოიხსნა და ისტორიაში გადავიდა.", "info");
}

async function permanentlyDeleteClientReport(report) {
  const confirmed = await showConfirm(
    `„${report.clientName || "უსახელო"}“ სამუდამოდ წაიშლება ისტორიიდან და ვეღარ აღდგება. გავაგრძელოთ?`,
    { title: "სამუდამო წაშლა" }
  );
  if (!confirmed) return;
  await deleteRecord(STORE, report.id);
  if (state.report.id === report.id) {
    state.report = createEmptyReport();
    syncFormFromReport();
  }
  await renderHistory();
  await renderGroupsPanel();
  showAlert("კლიენტი სამუდამოდ წაიშალა.", "info");
}

function startNewClientInGroup(groupId) {
  state.report = createEmptyReport();
  state.report.groupId = groupId;
  syncFormFromReport();
  renderGroupSelectOptions();
  setReportBodyOpen(true);
  clearAlert();
  window.scrollTo({ top: 0, behavior: "smooth" });
  els.reportForm.querySelector('[name="clientName"]')?.focus();
}

function loadClientIntoForm(report) {
  state.report = normalizeReport(report);
  syncFormFromReport();
  renderGroupSelectOptions();
  setReportBodyOpen(true);
  showAlert("კლიენტი ჩაიტვირთა ფორმაში.", "info");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function normalizeMapsLink(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  // Not a link (e.g. a pasted address) - build a tappable Google Maps search URL from it.
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(raw)}`;
}

function clientSortKey(report) {
  const jobDate = String(report.jobDate || "").trim();
  return jobDate || String(report.createdAt || "").slice(0, 10);
}

function sortClientsByDate(list) {
  return list.sort((a, b) => {
    const keyA = clientSortKey(a);
    const keyB = clientSortKey(b);
    if (keyA !== keyB) return keyA.localeCompare(keyB);
    return String(a.createdAt).localeCompare(String(b.createdAt));
  });
}

function formatJobDate(jobDate) {
  if (!jobDate) return "";
  const d = new Date(`${jobDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ka-GE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDuration(days) {
  const n = parseInt(days, 10);
  if (!n || n < 1) return "";
  return `${n} დღიანი`;
}

function formatJobSchedule(report) {
  const dateLabel = formatJobDate(report.jobDate);
  const durationLabel = formatDuration(report.jobDurationDays);
  if (dateLabel && durationLabel) return `${dateLabel} · ${durationLabel}`;
  return dateLabel || durationLabel || "";
}

function renderClientRow(report, { deleteMode = "archive" } = {}) {
  const scheduleLabel = formatJobSchedule(report);
  const secondaryHtml = scheduleLabel
    ? `<small class="client-schedule">📅 ${escapeHtml(scheduleLabel)}</small>`
    : `<small>დამატებულია: ${new Date(report.createdAt).toLocaleDateString("ka-GE")}</small>`;
  const mapsBtn = report.googleMapsLink
    ? `<button type="button" class="client-maps-btn" data-action="maps" data-id="${escapeHtml(report.id)}">📍 რუკა</button>`
    : "";
  const deleteLabel = deleteMode === "permanent" ? "სამუდამო წაშლა" : "წაშლა";
  return `
    <div class="client-row" data-id="${escapeHtml(report.id)}">
      <div class="client-row-info">
        <strong>${escapeHtml(report.clientName || "უსახელო კლიენტი")}</strong>
        ${secondaryHtml}
      </div>
      <div class="client-row-actions">
        <button type="button" data-action="load" data-id="${escapeHtml(report.id)}">ჩატვირთვა</button>
        ${mapsBtn}
        <button type="button" class="primary" data-action="share" data-id="${escapeHtml(report.id)}">გაზიარება</button>
        <button type="button" class="danger-action" data-action="delete" data-delete-mode="${deleteMode}" data-id="${escapeHtml(report.id)}">${deleteLabel}</button>
      </div>
    </div>`;
}

function renderCollapsibleGroupCard(key, name, clients, openIdsSet, { extraHeadBtns = "", deleteMode = "archive" } = {}) {
  const isOpen = openIdsSet.has(key);
  return `
    <div class="group-card${isOpen ? " is-open" : ""}" data-group-key="${escapeHtml(key)}">
      <div class="group-card-head">
        <button type="button" class="group-toggle-btn" data-toggle="${escapeHtml(key)}">
          <span class="group-toggle-caret">▸</span>
          <strong>${escapeHtml(name)}</strong>
          <span class="group-count">${clients.length} კლიენტი</span>
        </button>
        ${extraHeadBtns}
      </div>
      <div class="group-clients"${isOpen ? "" : " hidden"}>
        ${clients.length ? clients.map((r) => renderClientRow(r, { deleteMode })).join("") : '<p class="loading-empty">კლიენტები ჯერ არ არის</p>'}
      </div>
    </div>`;
}

async function renderGroupsPanel() {
  if (!els.groupsList) return;
  const [groups, reports] = await Promise.all([getGroups(), getReports()]);
  state.groups = groups;
  const activeReports = reports.filter((r) => !r.archived);
  const sortedGroups = [...groups].sort((a, b) => String(a.name).localeCompare(String(b.name), "ka"));
  const byGroup = new Map(sortedGroups.map((g) => [g.id, []]));
  activeReports.forEach((r) => {
    if (r.groupId && byGroup.has(r.groupId)) byGroup.get(r.groupId).push(r);
  });
  byGroup.forEach((list) => sortClientsByDate(list));

  const groupBlocks = sortedGroups
    .map((g) => {
      const actions = `
        <div class="group-card-actions">
          <button type="button" class="primary" data-group-action="add-client" data-id="${escapeHtml(g.id)}">+ კლიენტი</button>
          <button type="button" data-group-action="rename" data-id="${escapeHtml(g.id)}">გადარქმევა</button>
          <button type="button" class="danger-action" data-group-action="delete" data-id="${escapeHtml(g.id)}">წაშლა</button>
        </div>`;
      return renderCollapsibleGroupCard(g.id, g.name, byGroup.get(g.id) || [], state.openGroupIds, {
        extraHeadBtns: actions,
        deleteMode: "archive"
      });
    })
    .join("");

  els.groupsList.innerHTML = groupBlocks;

  if (!sortedGroups.length) {
    els.groupsList.innerHTML = '<p class="loading-empty">ჯერ არცერთი ჯგუფი არ არის დამატებული — შექმენი ჯგუფი ზემოთ</p>';
  }
}

function bindClientListEvents(container, { groupActions = false } = {}) {
  container?.addEventListener("click", async (event) => {
    const toggleBtn = event.target.closest("[data-toggle]");
    if (toggleBtn) {
      const key = toggleBtn.dataset.toggle;
      const card = toggleBtn.closest(".group-card");
      const clientsEl = card?.querySelector(".group-clients");
      if (!clientsEl) return;
      const willOpen = clientsEl.hidden;
      clientsEl.hidden = !willOpen;
      card.classList.toggle("is-open", willOpen);
      const openIdsSet = container === els.historyList ? state.openHistoryGroupIds : state.openGroupIds;
      if (willOpen) openIdsSet.add(key);
      else openIdsSet.delete(key);
      return;
    }
    const clientBtn = event.target.closest("[data-action]");
    if (clientBtn) {
      const id = clientBtn.dataset.id;
      const reports = await getReports();
      const report = reports.find((r) => r.id === id);
      if (!report) return;
      const action = clientBtn.dataset.action;
      if (action === "load") loadClientIntoForm(report);
      else if (action === "maps") window.open(normalizeMapsLink(report.googleMapsLink), "_blank", "noopener");
      else if (action === "share") shareReport(report, clientBtn);
      else if (action === "delete") {
        if (clientBtn.dataset.deleteMode === "permanent") permanentlyDeleteClientReport(report);
        else archiveClientReport(report);
      }
      return;
    }
    if (!groupActions) return;
    const groupBtn = event.target.closest("[data-group-action]");
    if (groupBtn) {
      const id = groupBtn.dataset.id;
      const group = state.groups.find((g) => g.id === id);
      if (!group) return;
      if (groupBtn.dataset.groupAction === "rename") renameGroupPrompt(group);
      else if (groupBtn.dataset.groupAction === "delete") removeGroup(group);
      else if (groupBtn.dataset.groupAction === "add-client") startNewClientInGroup(group.id);
    }
  });
}

function bindGroupsListEvents() {
  bindClientListEvents(els.groupsList, { groupActions: true });
  bindClientListEvents(els.historyList, { groupActions: false });
}

async function generateReportImageBlob(report) {
  if (!window.html2canvas) throw new Error("html2canvas ვერ ჩაიტვირთა");
  const wrapper = document.createElement("div");
  wrapper.className = "printable-report share-capture";
  wrapper.innerHTML = buildPrintableReportContent(report);
  document.body.appendChild(wrapper);
  await new Promise((resolve) => window.setTimeout(resolve, 60));
  try {
    const canvas = await window.html2canvas(wrapper, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  } finally {
    wrapper.remove();
  }
}

async function shareReport(report, triggerBtn) {
  clearAlert();
  if (triggerBtn) triggerBtn.disabled = true;
  try {
    const blob = await generateReportImageBlob(report);
    if (!blob) throw new Error("სურათი ვერ შეიქმნა");
    const fileName = `${(report.clientName || "client").replace(/\s+/g, "_")}.png`;
    const file = new File([blob], fileName, { type: "image/png" });
    const shareText = report.googleMapsLink ? normalizeMapsLink(report.googleMapsLink) : "";

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: report.clientName || "კლიენტი",
        text: shareText
      });
      showAlert("გაზიარება გაიხსნა.", "ok");
      return;
    }

    // Fallback for browsers without file Web Share support: download image + copy maps link.
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    if (shareText && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(shareText);
        showAlert("სურათი ჩამოიტვირთა, Maps ლინკი დაკოპირდა — ჩასვი WhatsApp-ში.", "ok");
        return;
      } catch {
        // clipboard permission may be denied; fall through to plain message
      }
    }
    showAlert("სურათი ჩამოიტვირთა. ეს მოწყობილობა/ბრაუზერი პირდაპირ გაზიარებას ვერ უჭერს მხარს.", "warn");
  } catch (error) {
    if (error?.name !== "AbortError") {
      showAlert("გაზიარება ვერ განხორციელდა, სცადე თავიდან.", "warn");
    }
  } finally {
    if (triggerBtn) triggerBtn.disabled = false;
  }
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
  <title>Plans PDF</title>
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

function buildPrintableReportContent(report = state.report) {
  const section = (title, body) => (body ? `<section class="report-section"><h2>${escapeHtml(title)}</h2>${body}</section>` : "");
  const text = (value) => escapeHtml(value).replace(/\r?\n/g, "<br>");
  const p = (label, value) => (hasValue(value) ? `<p><strong>${escapeHtml(label)}:</strong> ${text(value)}</p>` : "");
  const list = (items) => (hasValue(items) ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "");

  const client = [
    p("კლიენტი", report.clientName),
    p("მისამართი", report.address),
    p("ტელეფონი", report.phone),
    p("სამუშაოს თარიღი", formatJobSchedule(report))
  ].join("");
  const packageInfo = [
    p("პაკეტი", report.packageType),
    p("დუშთასე", report.showerTraySize),
    p("ანტირუჩი", report.antiSlip)
  ].join("");
  const materials = [
    p("შუშის ზომა", report.glassPartitionSize),
    p("კარი", report.hingedDoorSize),
    p("პანელის ფერი", report.panelColor),
    p("იატაკის პანელის ფერი", report.floorPanelColor),
    p("პანელი სადამდე კეთდება", report.panelHeight),
    hasValue(report.installables) ? `<h3>დასაყენებლების სია</h3>${list(report.installables)}` : ""
  ].join("");
  const sketchImage = window.BathroomSketch?.hasContent(report.sketch)
    ? window.BathroomSketch.createImage(report.sketch)
    : "";
  const sketch = sketchImage
    ? `<img class="sketch-report-image" src="${sketchImage}" alt="აბაზანის 2D ნახაზი" />`
    : "";

  return `
      <h1>Plans</h1>
      <p>ქართული სამუშაო ანგარიში</p>
      ${section("კლიენტის მონაცემები", client)}
      ${section("პაკეტი და დუშთასე", packageInfo)}
      ${section("მასალები", materials)}
      ${section("დამატებითი სამუშაოები", list(report.extraWork))}
      ${section("შენიშვნები", list(report.workNotes))}
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

function showConfirm(message, options = {}) {
  const dialog = document.getElementById("confirmDialog");
  const titleEl = document.getElementById("confirmDialogTitle");
  const messageEl = document.getElementById("confirmDialogMessage");
  const okBtn = document.getElementById("confirmDialogOkBtn");
  const cancelBtn = document.getElementById("confirmDialogCancelBtn");
  if (!dialog || !titleEl || !messageEl || !okBtn || !cancelBtn) {
    // Fallback if the dialog markup is somehow missing - keeps the app usable either way.
    return Promise.resolve(window.confirm(message));
  }

  titleEl.textContent = options.title || "დაადასტურე";
  messageEl.textContent = message;
  okBtn.textContent = options.confirmText || "დადასტურება";
  cancelBtn.textContent = options.cancelText || "გაუქმება";
  okBtn.classList.toggle("confirm-danger-btn", options.danger !== false);
  okBtn.classList.toggle("primary", options.danger === false);

  return new Promise((resolve) => {
    dialog.returnValue = "cancel";
    const onClose = () => {
      dialog.removeEventListener("close", onClose);
      resolve(dialog.returnValue === "ok");
    };
    okBtn.onclick = () => {
      dialog.returnValue = "ok";
      dialog.close();
    };
    cancelBtn.onclick = () => {
      dialog.returnValue = "cancel";
      dialog.close();
    };
    dialog.addEventListener("close", onClose);
    dialog.showModal();
  });
}
window.AppConfirm = showConfirm;

function showUpdateDialog(onConfirm) {
  const dialog = els.updateDialog;
  if (!dialog) {
    // Fallback if dialog markup is missing for any reason.
    if (window.confirm("ახალი ვერსია მზადაა. განახლდეს ახლავე?")) onConfirm();
    return;
  }
  if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();

  const onYes = () => {
    cleanup();
    dialog.close();
    onConfirm();
  };
  const onNo = () => {
    cleanup();
    dialog.close();
  };
  function cleanup() {
    els.updateYesBtn.removeEventListener("click", onYes);
    els.updateNoBtn.removeEventListener("click", onNo);
  }
  els.updateYesBtn.addEventListener("click", onYes);
  els.updateNoBtn.addEventListener("click", onNo);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  let promptShown = false;
  function promptForUpdate(registration) {
    if (promptShown) return;
    const waitingWorker = registration.waiting;
    if (!waitingWorker) return;
    promptShown = true;
    showUpdateDialog(() => {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    });
  }

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });

  navigator.serviceWorker
    .register("service-worker.js")
    .then((registration) => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        promptForUpdate(registration);
      }
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            promptForUpdate(registration);
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
    const confirmed = await showConfirm(
      "წაიშლება ისტორიაში შენახული ყველა კლიენტი, ყველა ჯგუფში. ეს ქმედება ვერ გაუქმდება. გავაგრძელოთ?",
      { title: "მთელი ისტორიის წაშლა" }
    );
    if (!confirmed) return;
    await clearReports();
    await renderHistory();
    await renderGroupsPanel();
    showAlert("ისტორია წაიშალა.", "info");
  });
  els.modeReportBtn?.addEventListener("click", () => setMode("report"));
  els.modeLoadingBtn?.addEventListener("click", () => setMode("loading"));
  els.modePeriodsBtn?.addEventListener("click", () => setMode("periods"));
  els.reportForm.addEventListener("change", () => {
    syncReportFromForm();
    clearAlert();
  });
  els.addGroupBtn?.addEventListener("click", addGroup);
  els.reportToggleBtn?.addEventListener("click", () => {
    setReportBodyOpen(els.reportBody?.hidden !== false);
  });
  els.newGroupInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addGroup();
    }
  });
  bindGroupsListEvents();
  bindSimpleToggle(els.templatesToggleBtn, els.templatesToolbar, els.templatesBody);
  bindTemplatePickerEvents();
  bindTemplatesPanelEvents();
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
  await loadGroups();
  await renderGroupsPanel();
  await loadTemplates();
  window.LoadingMode?.init();
  window.PeriodsMode?.init();
  restoreMode();
  registerServiceWorker();
}

init();
