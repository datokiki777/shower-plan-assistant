import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { AppDatabase } from "@/db/database";
import { LocalGroupRepository } from "@/db/repositories/group.repository";
import { LocalJobRepository } from "@/db/repositories/job.repository";
import { LocalClientRepository } from "@/db/repositories/client.repository";

describe("LocalGroupRepository", () => {
  let testDb: AppDatabase;
  let groups: LocalGroupRepository;
  let jobs: LocalJobRepository;
  let clients: LocalClientRepository;

  beforeEach(() => {
    testDb = new AppDatabase(`test-${crypto.randomUUID()}`);
    groups = new LocalGroupRepository(testDb);
    jobs = new LocalJobRepository(testDb);
    clients = new LocalClientRepository(testDb);
  });

  afterEach(async () => {
    testDb.close();
    await testDb.delete();
  });

  it("creates, lists (excluding archived by default), and renames a group", async () => {
    const g = await groups.create({ name: "სიდნი" });
    expect((await groups.list()).map((x) => x.id)).toContain(g.id);

    await groups.rename(g.id, "ბერლინი");
    const renamed = await groups.getById(g.id);
    expect(renamed?.name).toBe("ბერლინი");
  });

  it("archiving a group with jobs does NOT delete or modify those jobs (fixes the V1 risk)", async () => {
    const client = await clients.create({ fullName: "კლიენტი", address: "", phone: "", googleMapsLink: "", notes: "" });
    const group = await groups.create({ name: "ჯგუფი" });
    const job = await jobs.create({
      clientId: client.id,
      groupId: group.id,
      status: "active",
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
      clientSnapshot: { fullName: client.fullName, address: "", phone: "" }
    });

    await groups.archive(group.id);

    const archivedGroup = await groups.getById(group.id);
    expect(archivedGroup?.archivedAt).not.toBeNull();

    // The job must be completely untouched - still exists, same groupId, same status.
    const stillThere = await jobs.getById(job.id);
    expect(stillThere).toBeDefined();
    expect(stillThere?.groupId).toBe(group.id);
    expect(stillThere?.status).toBe("active");
    expect(stillThere?.archivedAt).toBeNull();
  });

  it("restoring a group clears archivedAt", async () => {
    const group = await groups.create({ name: "ჯგუფი" });
    await groups.archive(group.id);
    await groups.restore(group.id);
    const restored = await groups.getById(group.id);
    expect(restored?.archivedAt).toBeNull();
  });

  it("countByGroup on JobRepository correctly reflects job count for the safe-delete UI check", async () => {
    const client = await clients.create({ fullName: "კლიენტი", address: "", phone: "", googleMapsLink: "", notes: "" });
    const group = await groups.create({ name: "ჯგუფი" });
    expect(await jobs.countByGroup(group.id)).toBe(0);

    await jobs.create({
      clientId: client.id,
      groupId: group.id,
      status: "active",
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
      clientSnapshot: { fullName: client.fullName, address: "", phone: "" }
    });

    expect(await jobs.countByGroup(group.id)).toBe(1);
  });
});
