import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { AppDatabase } from "@/db/database";
import { parseLegacyExport, findExistingImport, buildPreview, runLegacyImport } from "./importLegacyData";
import type { LegacyExport } from "./schema";

function makeExport(overrides: Partial<LegacyExport> = {}): LegacyExport {
  return {
    format: "shower-plan-assistant-legacy-export",
    sourceVersion: 1,
    sourceDbVersion: 5,
    exportVersion: 1,
    exportId: crypto.randomUUID(),
    exportedAt: "2026-08-15T10:00:00.000Z",
    data: {
      reports: [
        {
          id: "legacy-job-1",
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
          archived: false
        }
      ],
      groups: [],
      templates: [],
      loadingLists: [],
      workers: []
    },
    ...overrides
  };
}

describe("parseLegacyExport", () => {
  it("rejects invalid JSON", () => {
    const result = parseLegacyExport("{not json");
    expect(result.ok).toBe(false);
  });

  it("rejects a wrong format string", () => {
    const result = parseLegacyExport(JSON.stringify({ ...makeExport(), format: "something-else" }));
    expect(result.ok).toBe(false);
  });

  it("rejects an unsupported sourceVersion", () => {
    const result = parseLegacyExport(JSON.stringify(makeExport({ sourceVersion: 99 })));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("sourceVersion");
  });

  it("accepts a well-formed real-shape export", () => {
    const result = parseLegacyExport(JSON.stringify(makeExport()));
    expect(result.ok).toBe(true);
  });
});

describe("runLegacyImport (against an isolated test database)", () => {
  let testDb: AppDatabase;

  beforeEach(() => {
    testDb = new AppDatabase(`test-import-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    testDb.close();
    await testDb.delete();
  });

  it("writes all records and a MigrationRecord in one successful import", async () => {
    const legacyExport = makeExport();
    const preview = buildPreview(legacyExport);

    await runLegacyImport(legacyExport, preview, testDb);

    expect(await testDb.jobs.count()).toBe(1);
    expect(await testDb.clients.count()).toBe(1);
    const migrationRecord = await testDb.migrationRecords.where("sourceExportId").equals(legacyExport.exportId).first();
    expect(migrationRecord).toBeDefined();
    expect(migrationRecord?.recordCounts.jobs).toBe(1);
  });

  it("duplicate-import protection: findExistingImport detects an already-imported exportId", async () => {
    const legacyExport = makeExport();
    const preview = buildPreview(legacyExport);
    await runLegacyImport(legacyExport, preview, testDb);

    const found = await findExistingImport(legacyExport.exportId, testDb);
    expect(found).toBeDefined();
    expect(found?.sourceExportId).toBe(legacyExport.exportId);

    const notFound = await findExistingImport("some-other-export-id", testDb);
    expect(notFound).toBeUndefined();
  });

  it("rolls back completely if any part of the write fails (no partial import)", async () => {
    const legacyExport = makeExport();
    const preview = buildPreview(legacyExport);

    await testDb.jobs.add({
      id: "legacy-job-1",
      clientId: "pre-existing",
      groupId: null,
      status: "active",
      statusBeforeArchive: null,
      jobDate: null,
      jobDurationDays: null,
      packageType: "",
      antiSlip: "",
      showerTraySize: "",
      glassPartitionSize: [],
      hingedDoorSize: "",
      panelColor: "",
      floorPanelColor: "",
      panelHeight: "",
      installables: [],
      extraWork: [],
      workNotes: [],
      clientSnapshot: { fullName: "", address: "", phone: "" },
      createdAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2020-01-01T00:00:00.000Z",
      archivedAt: null
    });

    await expect(runLegacyImport(legacyExport, preview, testDb)).rejects.toBeDefined();

    expect(await testDb.clients.count()).toBe(0);
    expect(await findExistingImport(legacyExport.exportId, testDb)).toBeUndefined();
    expect(await testDb.jobs.count()).toBe(1);
    expect((await testDb.jobs.get("legacy-job-1"))?.clientId).toBe("pre-existing");
  });
});
