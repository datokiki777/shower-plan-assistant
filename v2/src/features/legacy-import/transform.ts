import type { LegacyExport, LegacyReport } from "./schema";
import type { Client } from "@/entities/client";
import type { Job } from "@/entities/job";
import type { Group } from "@/entities/group";
import type { FieldTemplate, TemplateFieldKey } from "@/entities/template";
import type { LoadingList } from "@/entities/loading-list";
import type { LoadingItem } from "@/entities/loading-item";
import type { Worker } from "@/entities/worker";
import type { Stay } from "@/entities/stay";

export interface TransformResult {
  clients: Client[];
  jobs: Job[];
  groups: Group[];
  fieldTemplates: FieldTemplate[];
  loadingLists: LoadingList[];
  loadingItems: LoadingItem[];
  workers: Worker[];
  stays: Stay[];
  warnings: string[];
  counts: {
    clients: number;
    jobs: number;
    groups: number;
    fieldTemplates: number;
    loadingLists: number;
    loadingItems: number;
    workers: number;
    stays: number;
  };
}

const TEMPLATE_FIELD_KEYS: TemplateFieldKey[] = [
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

function textToLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function normalizeNameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("ka");
}

/** Deterministic, non-fuzzy dedup key: normalized full name AND (phone if
 * present, else address if present). No match key at all (no name, or a
 * name but neither phone nor address) means "never merge" - see
 * MIGRATION_PLAN.md §6. */
function clientMatchKey(fullName: string, phone: string, address: string): string | null {
  const name = normalizeNameKey(fullName);
  if (!name) return null;
  if (phone.trim()) return `${name}|phone:${phone.trim()}`;
  if (address.trim()) return `${name}|addr:${address.trim()}`;
  return null;
}

function parseDurationDays(value: string | number): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return value === "" || value == null || Number.isNaN(n) || n <= 0 ? null : n;
}

export function transformV1ToV2(data: LegacyExport["data"]): TransformResult {
  const warnings: string[] = [];
  const now = new Date().toISOString();

  const groupIds = new Set(data.groups.map((g) => g.id));
  const groups: Group[] = data.groups.map((g) => ({
    id: g.id,
    name: g.name,
    createdAt: g.createdAt,
    updatedAt: g.createdAt,
    archivedAt: null
  }));

  const clientByKey = new Map<string, Client>();
  const clients: Client[] = [];
  const jobs: Job[] = [];
  let orphanedGroupCount = 0;
  let droppedSketchCount = 0;

  const resolveClient = (report: LegacyReport): Client => {
    const key = clientMatchKey(report.clientName, report.phone, report.address);
    if (key) {
      const existing = clientByKey.get(key);
      if (existing) return existing;
    }
    const client: Client = {
      id: crypto.randomUUID(),
      fullName: report.clientName,
      address: report.address,
      phone: report.phone,
      googleMapsLink: report.googleMapsLink,
      notes: "",
      createdAt: report.createdAt,
      updatedAt: report.createdAt,
      archivedAt: null
    };
    clients.push(client);
    if (key) clientByKey.set(key, client);
    return client;
  };

  for (const report of data.reports) {
    const client = resolveClient(report);

    let groupId: string | null = report.groupId || null;
    if (groupId && !groupIds.has(groupId)) {
      groupId = null;
      orphanedGroupCount++;
    }
    if (report.sketch != null) droppedSketchCount++;

    const job: Job = {
      id: report.id,
      clientId: client.id,
      groupId,
      status: report.archived ? "archived" : "active",
      statusBeforeArchive: null,
      jobDate: report.jobDate || null,
      jobDurationDays: parseDurationDays(report.jobDurationDays),
      packageType: report.packageType,
      antiSlip: report.antiSlip,
      showerTraySize: report.showerTraySize,
      glassPartitionSize: textToLines(report.glassPartitionSize),
      hingedDoorSize: report.hingedDoorSize,
      panelColor: report.panelColor,
      floorPanelColor: report.floorPanelColor,
      panelHeight: report.panelHeight,
      installables: report.installables,
      extraWork: report.extraWork,
      workNotes: report.workNotes,
      clientSnapshot: { fullName: report.clientName, address: report.address, phone: report.phone },
      createdAt: report.createdAt,
      updatedAt: report.createdAt,
      archivedAt: report.archived ? report.createdAt : null
    };
    jobs.push(job);
  }

  if (orphanedGroupCount > 0) {
    warnings.push(`${orphanedGroupCount} job(s) referenced a group not present in this export and were left ungrouped.`);
  }
  if (droppedSketchCount > 0) {
    warnings.push(`${droppedSketchCount} job(s) had a bathroom sketch that was not migrated (sketch editor is out of V2 scope).`);
  }

  const fieldTemplates: FieldTemplate[] = [];
  const templateSource = data.templates[0];
  if (templateSource) {
    for (const fieldKey of TEMPLATE_FIELD_KEYS) {
      const values = templateSource[fieldKey] ?? [];
      values.forEach((value, index) => {
        fieldTemplates.push({ id: crypto.randomUUID(), fieldKey, value, sortOrder: index, createdAt: now, updatedAt: now });
      });
    }
  }

  const loadingLists: LoadingList[] = [];
  const loadingItems: LoadingItem[] = [];
  for (const list of data.loadingLists) {
    loadingLists.push({ id: list.id, title: list.title, createdAt: list.createdAt, updatedAt: list.createdAt, archivedAt: null });

    list.trays.forEach((item, index) => {
      loadingItems.push({
        id: item.id ?? crypto.randomUUID(),
        loadingListId: list.id,
        category: "trays",
        name: "",
        note: item.note,
        quantity: null,
        doorInfo: null,
        checked: item.checked,
        sortOrder: index,
        createdAt: list.createdAt,
        updatedAt: list.createdAt
      });
    });
    list.glass.forEach((item, index) => {
      loadingItems.push({
        id: item.id ?? crypto.randomUUID(),
        loadingListId: list.id,
        category: "glass",
        name: "",
        note: item.note,
        quantity: null,
        doorInfo: item.door,
        checked: item.checked,
        sortOrder: index,
        createdAt: list.createdAt,
        updatedAt: list.createdAt
      });
    });
    list.panels.forEach((item, index) => {
      loadingItems.push({
        id: item.id ?? crypto.randomUUID(),
        loadingListId: list.id,
        category: "panels",
        name: item.name,
        note: "",
        quantity: item.qty || null,
        doorInfo: null,
        checked: item.checked,
        sortOrder: index,
        createdAt: list.createdAt,
        updatedAt: list.createdAt
      });
    });
    list.extras.forEach((item, index) => {
      loadingItems.push({
        id: item.id ?? crypto.randomUUID(),
        loadingListId: list.id,
        category: "extras",
        name: item.name,
        note: "",
        quantity: item.qty || null,
        doorInfo: null,
        checked: item.checked,
        sortOrder: index,
        createdAt: list.createdAt,
        updatedAt: list.createdAt
      });
    });
  }

  const workers: Worker[] = [];
  const stays: Stay[] = [];
  for (const w of data.workers) {
    workers.push({ id: w.id, name: w.name, createdAt: w.createdAt, updatedAt: w.createdAt, archivedAt: null });
    for (const s of w.stays) {
      stays.push({
        id: s.id,
        workerId: w.id,
        entryDate: s.entry,
        exitDate: s.exit,
        createdAt: w.createdAt,
        updatedAt: w.createdAt
      });
    }
  }

  return {
    clients,
    jobs,
    groups,
    fieldTemplates,
    loadingLists,
    loadingItems,
    workers,
    stays,
    warnings,
    counts: {
      clients: clients.length,
      jobs: jobs.length,
      groups: groups.length,
      fieldTemplates: fieldTemplates.length,
      loadingLists: loadingLists.length,
      loadingItems: loadingItems.length,
      workers: workers.length,
      stays: stays.length
    }
  };
}
