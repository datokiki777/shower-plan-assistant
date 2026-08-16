import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { AppDatabase } from "@/db/database";
import { buildBackup, parseBackup, restoreBackup } from "./backupService";
import { V2_BACKUP_FORMAT, type V2Backup } from "./schema";

describe("backupService", () => {
  let testDb: AppDatabase;

  beforeEach(() => {
    testDb = new AppDatabase(`test-backup-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    testDb.close();
    await testDb.delete();
  });

  it("buildBackup captures every table's current rows with the correct format/version", async () => {
    await testDb.groups.add({ id: "g1", name: "ჯგუფი", createdAt: "2026-01-01", updatedAt: "2026-01-01", archivedAt: null });
    const backup = await buildBackup(testDb);
    expect(backup.format).toBe(V2_BACKUP_FORMAT);
    expect(backup.data.groups).toHaveLength(1);
    expect(backup.data.jobs).toHaveLength(0);
  });

  it("parseBackup rejects invalid JSON and wrong format", () => {
    expect(parseBackup("{bad").ok).toBe(false);
    expect(parseBackup(JSON.stringify({ format: "wrong" })).ok).toBe(false);
  });

  it("restoreBackup REPLACES existing data (clears tables first)", async () => {
    await testDb.groups.add({ id: "old-group", name: "ძველი", createdAt: "2020-01-01", updatedAt: "2020-01-01", archivedAt: null });

    const backup: V2Backup = {
      format: V2_BACKUP_FORMAT,
      schemaVersion: 1,
      backupId: "b1",
      exportedAt: "2026-08-15T00:00:00.000Z",
      data: {
        clients: [],
        jobs: [],
        groups: [{ id: "new-group", name: "ახალი", createdAt: "2026-01-01", updatedAt: "2026-01-01", archivedAt: null }],
        fieldTemplates: [],
        loadingLists: [],
        loadingItems: [],
        workers: [],
        stays: []
      }
    };

    await restoreBackup(backup, testDb);

    const groups = await testDb.groups.toArray();
    expect(groups).toHaveLength(1);
    expect(groups[0]?.id).toBe("new-group");
    expect(await testDb.groups.get("old-group")).toBeUndefined();
  });

  it("a failed restore rolls back completely - original data survives", async () => {
    await testDb.groups.add({ id: "keep-me", name: "შენარჩუნებული", createdAt: "2020-01-01", updatedAt: "2020-01-01", archivedAt: null });

    const backup: V2Backup = {
      format: V2_BACKUP_FORMAT,
      schemaVersion: 1,
      backupId: "b1",
      exportedAt: "2026-08-15T00:00:00.000Z",
      data: {
        clients: [],
        jobs: [],
        groups: [{ id: "g1", name: "ვალიდური" }, { id: "g1", name: "დუბლიკატი id" }] as never,
        fieldTemplates: [],
        loadingLists: [],
        loadingItems: [],
        workers: [],
        stays: []
      }
    };

    await expect(restoreBackup(backup, testDb)).rejects.toBeDefined();

    expect(await testDb.groups.get("keep-me")).toBeDefined();
    expect(await testDb.groups.count()).toBe(1);
  });
});
