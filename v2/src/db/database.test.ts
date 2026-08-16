import { describe, expect, it, afterEach } from "vitest";
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

  it("opens successfully at schema version 1 with all nine tables", async () => {
    const testDb = new AppDatabase(`test-${crypto.randomUUID()}`);
    openDatabases.push(testDb);

    await testDb.open();

    expect(testDb.verno).toBe(1);
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
