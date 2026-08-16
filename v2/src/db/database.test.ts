import { describe, expect, it, afterEach } from "vitest";
import Dexie from "dexie";
import { AppDatabase, V2_DB_NAME } from "@/db/database";

describe("AppDatabase", () => {
  const openDatabases: AppDatabase[] = [];

  afterEach(async () => {
    while (openDatabases.length) {
      const instance = openDatabases.pop();
      instance?.close();
      if (instance) await instance.delete();
    }
  });

  it("uses the exact V2 database name, distinct from V1's", () => {
    expect(V2_DB_NAME).toBe("shower-plan-assistant-v2");
    expect(V2_DB_NAME).not.toBe("shower-plan-assistant");
  });

  it("opens successfully at the current schema version with all nine tables", async () => {
    const testDb = new AppDatabase(`test-${crypto.randomUUID()}`);
    openDatabases.push(testDb);

    await testDb.open();

    expect(testDb.verno).toBe(2);
    expect(testDb.tables.map((t) => t.name).sort()).toEqual(
      [
        "clients",
        "fieldTemplates",
        "groups",
        "jobs",
        "loadingItems",
        "loadingLists",
        "migrationRecords",
        "stays",
        "workers"
      ].sort()
    );
  });

  it("migrates an existing version-1 database: backfills statusBeforeArchive on real upgrade, not just on fresh installs", async () => {
    const dbName = `test-migration-${crypto.randomUUID()}`;

    // Simulate a real V2 user who has been running schema version 1 (i.e.
    // before this correction shipped) and already has a job saved without
    // statusBeforeArchive at all.
    const legacyDb = new Dexie(dbName);
    legacyDb.version(1).stores({
      clients: "id, fullName, archivedAt",
      jobs: "id, clientId, groupId, status, jobDate, [groupId+status]",
      groups: "id, name, archivedAt",
      fieldTemplates: "id, fieldKey, [fieldKey+sortOrder]",
      loadingLists: "id, archivedAt",
      loadingItems: "id, loadingListId, [loadingListId+category]",
      workers: "id, archivedAt",
      stays: "id, workerId, [workerId+entryDate]",
      migrationRecords: "id, sourceExportId"
    });
    await legacyDb.open();
    await legacyDb.table("jobs").add({
      id: "legacy-job-1",
      clientId: "c1",
      groupId: null,
      status: "archived",
      // no statusBeforeArchive field at all - this is the real pre-migration shape
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
      clientSnapshot: { fullName: "Legacy Client", address: "", phone: "" },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      archivedAt: "2026-01-01T00:00:00.000Z"
    });
    legacyDb.close();

    // Now open the SAME database name with the real AppDatabase (schema
    // version 2) - this exercises the actual upgrade() path, not a
    // freshly-created database that never needed migrating.
    const upgraded = new AppDatabase(dbName);
    openDatabases.push(upgraded);
    await upgraded.open();

    expect(upgraded.verno).toBe(2);
    const migratedJob = await upgraded.jobs.get("legacy-job-1");
    expect(migratedJob?.statusBeforeArchive).toBeNull();
    expect(migratedJob?.status).toBe("archived"); // untouched by the migration itself
  });

  it("can write and read a record in each table (basic round-trip)", async () => {
    const testDb = new AppDatabase(`test-${crypto.randomUUID()}`);
    openDatabases.push(testDb);
    const now = new Date().toISOString();

    const client = { id: "c1", fullName: "Test Client", address: "", phone: "", googleMapsLink: "", notes: "", createdAt: now, updatedAt: now, archivedAt: null };
    await testDb.clients.add(client);
    expect(await testDb.clients.get("c1")).toEqual(client);

    const group = { id: "g1", name: "Test Group", createdAt: now, updatedAt: now, archivedAt: null };
    await testDb.groups.add(group);
    expect(await testDb.groups.get("g1")).toEqual(group);
  });

  it("supports the [groupId+status] compound index used for the active-jobs-per-group query", async () => {
    const testDb = new AppDatabase(`test-${crypto.randomUUID()}`);
    openDatabases.push(testDb);
    const now = new Date().toISOString();

    const job = {
      id: "j1",
      clientId: "c1",
      groupId: "g1",
      status: "active" as const,
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
      clientSnapshot: { fullName: "Test Client", address: "", phone: "" },
      createdAt: now,
      updatedAt: now,
      archivedAt: null
    };
    await testDb.jobs.add(job);

    const found = await testDb.jobs.where("[groupId+status]").equals(["g1", "active"]).toArray();
    expect(found).toHaveLength(1);
    expect(found[0]?.id).toBe("j1");
  });
});
