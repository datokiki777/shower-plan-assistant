import { describe, expect, it } from "vitest";
import { transformV1ToV2 } from "./transform";
import type { LegacyExport } from "./schema";

function baseData(overrides: Partial<LegacyExport["data"]> = {}): LegacyExport["data"] {
  return { reports: [], groups: [], templates: [], loadingLists: [], workers: [], ...overrides };
}

function report(overrides: Partial<LegacyExport["data"]["reports"][number]> = {}): LegacyExport["data"]["reports"][number] {
  return {
    id: crypto.randomUUID(),
    createdAt: "2026-01-01T00:00:00.000Z",
    clientName: "გიორგი მაისურაძე",
    address: "თბილისი",
    phone: "555111222",
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
    archived: false,
    ...overrides
  };
}

describe("transformV1ToV2", () => {
  it("archived:false -> status active, archived:true -> status archived, statusBeforeArchive always null", () => {
    const result = transformV1ToV2(baseData({ reports: [report({ archived: false }), report({ archived: true })] }));
    expect(result.jobs[0]?.status).toBe("active");
    expect(result.jobs[0]?.statusBeforeArchive).toBeNull();
    expect(result.jobs[1]?.status).toBe("archived");
    expect(result.jobs[1]?.statusBeforeArchive).toBeNull();
    expect(result.jobs[1]?.archivedAt).not.toBeNull();
  });

  it("preserves report.id as Job.id", () => {
    const r = report({ id: "legacy-report-1" });
    const result = transformV1ToV2(baseData({ reports: [r] }));
    expect(result.jobs[0]?.id).toBe("legacy-report-1");
  });

  it("splits glassPartitionSize's multiline string into an array", () => {
    const result = transformV1ToV2(baseData({ reports: [report({ glassPartitionSize: "შუშა 100სმ\nშუშა 90სმ\n" })] }));
    expect(result.jobs[0]?.glassPartitionSize).toEqual(["შუშა 100სმ", "შუშა 90სმ"]);
  });

  it("client dedup: same name + same phone across two reports -> one Client, two Jobs", () => {
    const result = transformV1ToV2(
      baseData({
        reports: [
          report({ clientName: "გიორგი მაისურაძე", phone: "555111222", address: "მისამართი 1" }),
          report({ clientName: "გიორგი მაისურაძე", phone: "555111222", address: "მისამართი 2" })
        ]
      })
    );
    expect(result.clients).toHaveLength(1);
    expect(result.jobs).toHaveLength(2);
    expect(result.jobs[0]?.clientId).toBe(result.jobs[1]?.clientId);
    // Each job's snapshot still reflects that report's own address, not a merged value.
    expect(result.jobs[0]?.clientSnapshot.address).toBe("მისამართი 1");
    expect(result.jobs[1]?.clientSnapshot.address).toBe("მისამართი 2");
  });

  it("client dedup: same name but DIFFERENT phone numbers -> two separate Clients (no fuzzy matching)", () => {
    const result = transformV1ToV2(
      baseData({
        reports: [report({ clientName: "გიორგი მაისურაძე", phone: "111" }), report({ clientName: "გიორგი მაისურაძე", phone: "999" })]
      })
    );
    expect(result.clients).toHaveLength(2);
  });

  it("client dedup: no phone AND no address on either report -> never merged, even with identical names", () => {
    const result = transformV1ToV2(
      baseData({
        reports: [report({ clientName: "სახელი", phone: "", address: "" }), report({ clientName: "სახელი", phone: "", address: "" })]
      })
    );
    expect(result.clients).toHaveLength(2);
  });

  it("a job referencing a group ID not present in the export is left ungrouped, with a warning", () => {
    const result = transformV1ToV2(baseData({ reports: [report({ groupId: "missing-group" })], groups: [] }));
    expect(result.jobs[0]?.groupId).toBeNull();
    expect(result.warnings.some((w) => w.includes("group"))).toBe(true);
  });

  it("a job with a non-null sketch produces a warning but is not dropped", () => {
    const result = transformV1ToV2(baseData({ reports: [report({ sketch: { some: "data" } })] }));
    expect(result.jobs).toHaveLength(1);
    expect(result.warnings.some((w) => w.includes("sketch"))).toBe(true);
  });

  it("flattens the single template wrapper record into one row per value, preserving order as sortOrder", () => {
    const result = transformV1ToV2(baseData({ templates: [{ packageType: ["S", "M", "L"] } as never] }));
    const pkg = result.fieldTemplates.filter((t) => t.fieldKey === "packageType");
    expect(pkg.map((t) => t.value)).toEqual(["S", "M", "L"]);
    expect(pkg.map((t) => t.sortOrder)).toEqual([0, 1, 2]);
  });

  it("maps loading list categories to LoadingItem rows with the right field mapping", () => {
    const result = transformV1ToV2(
      baseData({
        loadingLists: [
          {
            id: "list1",
            createdAt: "2026-01-01T00:00:00.000Z",
            title: "სია",
            trays: [{ id: "t1", note: "თასი", checked: true }],
            glass: [{ id: "g1", note: "შუშა", door: "PK90", checked: false }],
            panels: [{ id: "p1", name: "პანელი", qty: "2", checked: false }],
            extras: []
          }
        ]
      })
    );
    expect(result.loadingLists).toHaveLength(1);
    expect(result.loadingItems).toHaveLength(3);
    const tray = result.loadingItems.find((i) => i.category === "trays");
    expect(tray?.note).toBe("თასი");
    expect(tray?.checked).toBe(true);
    const glass = result.loadingItems.find((i) => i.category === "glass");
    expect(glass?.doorInfo).toBe("PK90");
    const panel = result.loadingItems.find((i) => i.category === "panels");
    expect(panel?.name).toBe("პანელი");
    expect(panel?.quantity).toBe("2");
  });

  it("maps workers and preserves stay IDs, including an open (no exit) stay", () => {
    const result = transformV1ToV2(
      baseData({
        workers: [
          {
            id: "w1",
            name: "მუშა",
            createdAt: "2026-01-01T00:00:00.000Z",
            stays: [
              { id: "s1", entry: "2026-01-01", exit: "2026-01-10" },
              { id: "s2", entry: "2026-02-01", exit: null }
            ]
          }
        ]
      })
    );
    expect(result.workers).toHaveLength(1);
    expect(result.stays).toHaveLength(2);
    expect(result.stays.find((s) => s.id === "s2")?.exitDate).toBeNull();
    expect(result.stays.every((s) => s.workerId === "w1")).toBe(true);
  });
});
