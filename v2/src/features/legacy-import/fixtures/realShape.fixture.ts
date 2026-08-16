import type { LegacyExport } from "../schema";

/**
 * A synthetic but structurally-real V1 export matching the exact counts
 * verified against the real production backup: 18 reports, 3 groups, 52
 * template values, 2 loading lists totaling 61 items, 8 workers, 8 stays,
 * and (per the real backup) every report has `archived: false`.
 *
 * Client count is NOT a fixed input - it's the OUTPUT of conservative
 * deduplication (see transform.ts / MIGRATION_PLAN.md §6), so this fixture
 * is deliberately built with a known, hand-verifiable mix so the expected
 * result can be asserted exactly:
 *   - 2 reports share name+phone -> dedup to 1 client ("client A")
 *   - 2 reports share a different name+phone -> dedup to 1 client ("client B")
 *   - 2 reports share a name but have DIFFERENT phone numbers -> must NOT
 *     merge (no fuzzy matching) -> 2 separate clients ("client C1"/"C2")
 *   - the remaining 12 reports each have a unique name+phone -> 12 clients
 *   Expected total clients = 1 + 1 + 2 + 12 = 16
 */

const GROUP_IDS = ["legacy-group-1", "legacy-group-2", "legacy-group-3"];

function makeReport(index: number, overrides: Partial<LegacyExport["data"]["reports"][number]>): LegacyExport["data"]["reports"][number] {
  return {
    id: `legacy-report-${index}`,
    createdAt: `2026-0${(index % 6) + 1}-01T00:00:00.000Z`,
    clientName: `კლიენტი ${index}`,
    address: `მისამართი ${index}`,
    phone: `55510${String(index).padStart(4, "0")}`,
    googleMapsLink: "",
    jobDate: "",
    jobDurationDays: "",
    groupId: GROUP_IDS[index % GROUP_IDS.length] as string,
    packageType: "S",
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
    archived: false,
    ...overrides
  };
}

function buildReports(): LegacyExport["data"]["reports"] {
  const reports: LegacyExport["data"]["reports"] = [];

  reports.push(makeReport(1, { clientName: "გიორგი მაისურაძე", phone: "555100001" }));
  reports.push(makeReport(2, { clientName: "გიორგი მაისურაძე", phone: "555100001" }));

  reports.push(makeReport(3, { clientName: "ნინო ბერიძე", phone: "555100002" }));
  reports.push(makeReport(4, { clientName: "ნინო ბერიძე", phone: "555100002" }));

  reports.push(makeReport(5, { clientName: "დავით კვარაცხელია", phone: "555100003" }));
  reports.push(makeReport(6, { clientName: "დავით კვარაცხელია", phone: "555100004" }));

  for (let i = 7; i <= 18; i++) {
    reports.push(makeReport(i, {}));
  }

  return reports; // 2 + 2 + 2 + 12 = 18
}

function buildTemplates(): LegacyExport["data"]["templates"] {
  const fill = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}-${i + 1}`);
  return [
    {
      id: "main",
      createdAt: "2026-01-01T00:00:00.000Z",
      packageType: fill("package", 2),
      antiSlip: fill("antislip", 2),
      showerTraySize: fill("tray", 6),
      glassPartitionSize: fill("glass", 8),
      hingedDoorSize: fill("door", 6),
      panelColor: fill("panelColor", 10),
      floorPanelColor: fill("floorColor", 8),
      panelHeight: fill("height", 4),
      installables: fill("installable", 6)
    }
  ]; // 2+2+6+8+6+10+8+4+6 = 52
}

function buildLoadingLists(): LegacyExport["data"]["loadingLists"] {
  const trays = (listId: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `${listId}-tray-${i}`, note: `თასი ${i}`, checked: false }));
  const glass = (listId: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `${listId}-glass-${i}`, note: `შუშა ${i}`, door: "PK90", checked: false }));
  const panels = (listId: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `${listId}-panel-${i}`, name: `პანელი ${i}`, qty: "1", checked: false }));
  const extras = (listId: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `${listId}-extra-${i}`, name: `დამატება ${i}`, qty: "1", checked: false }));

  return [
    {
      id: "legacy-list-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      title: "სია 1",
      trays: trays("list1", 3),
      glass: glass("list1", 10),
      panels: panels("list1", 8),
      extras: extras("list1", 5)
    },
    {
      id: "legacy-list-2",
      createdAt: "2026-01-02T00:00:00.000Z",
      title: "სია 2",
      trays: trays("list2", 4),
      glass: glass("list2", 12),
      panels: panels("list2", 10),
      extras: extras("list2", 9)
    }
  ]; // 26 + 35 = 61 items total
}

function buildWorkers(): LegacyExport["data"]["workers"] {
  return Array.from({ length: 8 }, (_, i) => ({
    id: `legacy-worker-${i + 1}`,
    name: `მუშა ${i + 1}`,
    createdAt: "2026-01-01T00:00:00.000Z",
    stays: [
      {
        id: `legacy-stay-${i + 1}`,
        entry: `2026-0${(i % 6) + 1}-01`,
        exit: i % 2 === 0 ? `2026-0${(i % 6) + 1}-10` : null
      }
    ]
  })); // 8 workers, 8 stays (one each)
}

export function buildRealShapeLegacyExport(): LegacyExport {
  return {
    format: "shower-plan-assistant-legacy-export",
    sourceVersion: 1,
    sourceDbVersion: 5,
    exportVersion: 1,
    exportId: "real-shape-fixture-export-id",
    exportedAt: "2026-08-15T10:00:00.000Z",
    data: {
      reports: buildReports(),
      groups: GROUP_IDS.map((id, i) => ({ id, name: `ჯგუფი ${i + 1}`, createdAt: "2026-01-01T00:00:00.000Z" })),
      templates: buildTemplates(),
      loadingLists: buildLoadingLists(),
      workers: buildWorkers()
    }
  };
}

export const EXPECTED_COUNTS = {
  jobs: 18,
  groups: 3,
  clients: 16,
  fieldTemplates: 52,
  loadingLists: 2,
  loadingItems: 61,
  workers: 8,
  stays: 8
};
