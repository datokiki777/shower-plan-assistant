import { describe, expect, it, afterEach } from "vitest";
import { AppDatabase } from "@/db/database";
import { buildRealShapeLegacyExport, EXPECTED_COUNTS } from "./fixtures/realShape.fixture";
import { parseLegacyExport, buildPreview, runLegacyImport, findExistingImport } from "./importLegacyData";

describe("Real V1 backup shape migration verification", () => {
  let testDb: AppDatabase | null = null;

  afterEach(async () => {
    if (testDb) {
      testDb.close();
      await testDb.delete();
      testDb = null;
    }
  });

  it("parses and validates the real-shape export", () => {
    const legacyExport = buildRealShapeLegacyExport();
    const result = parseLegacyExport(JSON.stringify(legacyExport));
    expect(result.ok).toBe(true);
  });

  it("dry-run preview counts match the exact expected numbers, including derived client dedup", () => {
    const legacyExport = buildRealShapeLegacyExport();
    const preview = buildPreview(legacyExport);

    expect(preview.counts).toEqual(EXPECTED_COUNTS);
    expect(preview.warnings).toEqual([]);
  });

  it("a full real import writes exactly the expected row counts into every V2 table", async () => {
    testDb = new AppDatabase(`test-realshape-${crypto.randomUUID()}`);
    const legacyExport = buildRealShapeLegacyExport();
    const preview = buildPreview(legacyExport);

    const migrationRecord = await runLegacyImport(legacyExport, preview, testDb);

    expect(await testDb.jobs.count()).toBe(EXPECTED_COUNTS.jobs);
    expect(await testDb.groups.count()).toBe(EXPECTED_COUNTS.groups);
    expect(await testDb.clients.count()).toBe(EXPECTED_COUNTS.clients);
    expect(await testDb.fieldTemplates.count()).toBe(EXPECTED_COUNTS.fieldTemplates);
    expect(await testDb.loadingLists.count()).toBe(EXPECTED_COUNTS.loadingLists);
    expect(await testDb.loadingItems.count()).toBe(EXPECTED_COUNTS.loadingItems);
    expect(await testDb.workers.count()).toBe(EXPECTED_COUNTS.workers);
    expect(await testDb.stays.count()).toBe(EXPECTED_COUNTS.stays);

    expect(migrationRecord.recordCounts).toEqual(EXPECTED_COUNTS);
  });

  it("client dedup correctness: same name+phone merges, same name+different phone does not", async () => {
    testDb = new AppDatabase(`test-realshape-dedup-${crypto.randomUUID()}`);
    const legacyExport = buildRealShapeLegacyExport();
    const preview = buildPreview(legacyExport);
    await runLegacyImport(legacyExport, preview, testDb);

    const clients = await testDb.clients.toArray();
    const giorgi = clients.filter((c) => c.fullName === "გიორგი მაისურაძე");
    const nino = clients.filter((c) => c.fullName === "ნინო ბერიძე");
    const davit = clients.filter((c) => c.fullName === "დავით კვარაცხელია");

    expect(giorgi).toHaveLength(1);
    expect(nino).toHaveLength(1);
    expect(davit).toHaveLength(2);

    const giorgiJobs = (await testDb.jobs.toArray()).filter((j) => j.clientSnapshot.fullName === "გიორგი მაისურაძე");
    expect(giorgiJobs).toHaveLength(2);
    expect(giorgiJobs[0]?.clientId).toBe(giorgiJobs[1]?.clientId);
    expect(giorgiJobs[0]?.clientId).toBe(giorgi[0]?.id);
  });

  it("all 18 migrated jobs land as status:active with statusBeforeArchive:null (matches archived:false on every real report)", async () => {
    testDb = new AppDatabase(`test-realshape-status-${crypto.randomUUID()}`);
    const legacyExport = buildRealShapeLegacyExport();
    const preview = buildPreview(legacyExport);
    await runLegacyImport(legacyExport, preview, testDb);

    const jobs = await testDb.jobs.toArray();
    expect(jobs.every((j) => j.status === "active")).toBe(true);
    expect(jobs.every((j) => j.statusBeforeArchive === null)).toBe(true);
    expect(jobs.every((j) => j.archivedAt === null)).toBe(true);
  });

  it("duplicate-import protection recognizes this fixture's exportId after import", async () => {
    testDb = new AppDatabase(`test-realshape-dup-${crypto.randomUUID()}`);
    const legacyExport = buildRealShapeLegacyExport();
    const preview = buildPreview(legacyExport);
    await runLegacyImport(legacyExport, preview, testDb);

    const found = await findExistingImport(legacyExport.exportId, testDb);
    expect(found).toBeDefined();
    expect(found?.recordCounts).toEqual(EXPECTED_COUNTS);
  });
});
