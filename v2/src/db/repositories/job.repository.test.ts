import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { AppDatabase } from "@/db/database";
import { LocalJobRepository } from "@/db/repositories/job.repository";
import { LocalClientRepository } from "@/db/repositories/client.repository";
import { LocalGroupRepository } from "@/db/repositories/group.repository";
import type { Job } from "@/entities/job";

function blankJobInput(overrides: Partial<Job> & { clientId: string; clientSnapshot: Job["clientSnapshot"] }) {
  return {
    groupId: null,
    status: "planned" as const,
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
    ...overrides
  };
}

describe("LocalJobRepository", () => {
  let testDb: AppDatabase;
  let jobs: LocalJobRepository;
  let clients: LocalClientRepository;
  let groups: LocalGroupRepository;

  beforeEach(() => {
    testDb = new AppDatabase(`test-${crypto.randomUUID()}`);
    jobs = new LocalJobRepository(testDb);
    clients = new LocalClientRepository(testDb);
    groups = new LocalGroupRepository(testDb);
  });

  afterEach(async () => {
    testDb.close();
    await testDb.delete();
  });

  it("creates a job with generated id/timestamps and status as given", async () => {
    const client = await clients.create({ fullName: "კლიენტი", address: "", phone: "", googleMapsLink: "", notes: "" });
    const job = await jobs.create(blankJobInput({ clientId: client.id, clientSnapshot: { fullName: client.fullName, address: "", phone: "" } }));
    expect(job.id).toBeTruthy();
    expect(job.status).toBe("planned");
    expect(job.archivedAt).toBeNull();
  });

  it("editing a client's info LATER does not change an existing job's clientSnapshot (historical correctness)", async () => {
    const client = await clients.create({ fullName: "საწყისი სახელი", address: "ძველი მისამართი", phone: "111", googleMapsLink: "", notes: "" });
    const job = await jobs.create(
      blankJobInput({
        clientId: client.id,
        clientSnapshot: { fullName: client.fullName, address: client.address, phone: client.phone }
      })
    );

    // The client's real info changes later...
    await clients.update(client.id, { fullName: "ახალი სახელი", address: "ახალი მისამართი", phone: "999" });

    // ...but the job's snapshot must be completely untouched.
    const reloaded = await jobs.getById(job.id);
    expect(reloaded?.clientSnapshot).toEqual({ fullName: "საწყისი სახელი", address: "ძველი მისამართი", phone: "111" });
  });

  it("setStatus/archive/restore transitions set archivedAt consistently", async () => {
    const client = await clients.create({ fullName: "კლიენტი", address: "", phone: "", googleMapsLink: "", notes: "" });
    const job = await jobs.create(blankJobInput({ clientId: client.id, clientSnapshot: { fullName: client.fullName, address: "", phone: "" } }));

    await jobs.setStatus(job.id, "active");
    expect((await jobs.getById(job.id))?.status).toBe("active");
    expect((await jobs.getById(job.id))?.archivedAt).toBeNull();

    await jobs.archive(job.id);
    const archived = await jobs.getById(job.id);
    expect(archived?.status).toBe("archived");
    expect(archived?.archivedAt).not.toBeNull();

    await jobs.restore(job.id);
    const restored = await jobs.getById(job.id);
    expect(restored?.status).toBe("active");
    expect(restored?.archivedAt).toBeNull();
  });

  it.each(["planned", "active", "completed"] as const)(
    "archive() then restore() returns a %s job to exactly %s, not a hardcoded status",
    async (originalStatus) => {
      const client = await clients.create({ fullName: "კლიენტი", address: "", phone: "", googleMapsLink: "", notes: "" });
      const job = await jobs.create(
        blankJobInput({ clientId: client.id, status: originalStatus, clientSnapshot: { fullName: client.fullName, address: "", phone: "" } })
      );

      await jobs.archive(job.id);
      const archived = await jobs.getById(job.id);
      expect(archived?.status).toBe("archived");
      expect(archived?.statusBeforeArchive).toBe(originalStatus);
      expect(archived?.archivedAt).not.toBeNull();

      await jobs.restore(job.id);
      const restored = await jobs.getById(job.id);
      expect(restored?.status).toBe(originalStatus);
      expect(restored?.statusBeforeArchive).toBeNull();
      expect(restored?.archivedAt).toBeNull();
    }
  );

  it("restoring a legacy/imported archived job with no remembered prior status falls back to active, never guesses completed", async () => {
    const client = await clients.create({ fullName: "კლიენტი", address: "", phone: "", googleMapsLink: "", notes: "" });
    const job = await jobs.create(
      blankJobInput({ clientId: client.id, status: "completed", clientSnapshot: { fullName: client.fullName, address: "", phone: "" } })
    );
    // Simulate a legacy-imported record: already archived, but with no
    // statusBeforeArchive ever recorded (exactly what a V1 import produces -
    // see MIGRATION_PLAN.md §5).
    await testDb.jobs.update(job.id, { status: "archived", statusBeforeArchive: null, archivedAt: new Date().toISOString() });

    await jobs.restore(job.id);
    const restored = await jobs.getById(job.id);
    expect(restored?.status).toBe("active");
    expect(restored?.status).not.toBe("completed");
    expect(restored?.statusBeforeArchive).toBeNull();
  });

  it("archiving an already-archived job does not overwrite the remembered statusBeforeArchive", async () => {
    const client = await clients.create({ fullName: "კლიენტი", address: "", phone: "", googleMapsLink: "", notes: "" });
    const job = await jobs.create(
      blankJobInput({ clientId: client.id, status: "planned", clientSnapshot: { fullName: client.fullName, address: "", phone: "" } })
    );
    await jobs.archive(job.id);
    expect((await jobs.getById(job.id))?.statusBeforeArchive).toBe("planned");

    // Calling archive() again (e.g. a redundant call) must not clobber the
    // remembered "planned" with "archived".
    await jobs.archive(job.id);
    expect((await jobs.getById(job.id))?.statusBeforeArchive).toBe("planned");
  });

  it("list() filters by status and by group using indexed queries", async () => {
    const client = await clients.create({ fullName: "კლიენტი", address: "", phone: "", googleMapsLink: "", notes: "" });
    const groupA = await groups.create({ name: "A" });
    const groupB = await groups.create({ name: "B" });

    const j1 = await jobs.create(blankJobInput({ clientId: client.id, groupId: groupA.id, status: "active", clientSnapshot: { fullName: "x", address: "", phone: "" } }));
    await jobs.create(blankJobInput({ clientId: client.id, groupId: groupB.id, status: "active", clientSnapshot: { fullName: "x", address: "", phone: "" } }));
    await jobs.create(blankJobInput({ clientId: client.id, groupId: groupA.id, status: "planned", clientSnapshot: { fullName: "x", address: "", phone: "" } }));

    expect(await jobs.list({ groupId: groupA.id, status: "active" })).toEqual([expect.objectContaining({ id: j1.id })]);
    expect((await jobs.list({ status: "active" })).length).toBe(2);
    expect((await jobs.list({ groupId: groupA.id })).length).toBe(2);
  });

  it("search() matches non-archived jobs by client name or address, excludes archived", async () => {
    const client = await clients.create({ fullName: "კლიენტი", address: "", phone: "", googleMapsLink: "", notes: "" });
    const match = await jobs.create(
      blankJobInput({ clientId: client.id, status: "active", clientSnapshot: { fullName: "Giorgi Maisuradze", address: "Tbilisi", phone: "" } })
    );
    const archivedMatch = await jobs.create(
      blankJobInput({ clientId: client.id, status: "archived", clientSnapshot: { fullName: "Giorgi Archived", address: "", phone: "" } })
    );

    const results = await jobs.search("giorgi");
    expect(results.map((j) => j.id)).toContain(match.id);
    expect(results.map((j) => j.id)).not.toContain(archivedMatch.id);
  });

  it("listByClient returns all jobs for a client regardless of status", async () => {
    const client = await clients.create({ fullName: "კლიენტი", address: "", phone: "", googleMapsLink: "", notes: "" });
    await jobs.create(blankJobInput({ clientId: client.id, status: "active", clientSnapshot: { fullName: "x", address: "", phone: "" } }));
    await jobs.create(blankJobInput({ clientId: client.id, status: "archived", clientSnapshot: { fullName: "x", address: "", phone: "" } }));
    expect((await jobs.listByClient(client.id)).length).toBe(2);
  });
});
