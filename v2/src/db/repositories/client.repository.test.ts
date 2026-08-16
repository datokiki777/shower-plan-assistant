import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { AppDatabase } from "@/db/database";
import { LocalClientRepository } from "@/db/repositories/client.repository";

describe("LocalClientRepository", () => {
  let testDb: AppDatabase;
  let repo: LocalClientRepository;

  beforeEach(() => {
    testDb = new AppDatabase(`test-${crypto.randomUUID()}`);
    repo = new LocalClientRepository(testDb);
  });

  afterEach(async () => {
    testDb.close();
    await testDb.delete();
  });

  it("creates a client with generated id/timestamps and archivedAt=null", async () => {
    const client = await repo.create({ fullName: "გიორგი მაისურაძე", address: "", phone: "", googleMapsLink: "", notes: "" });
    expect(client.id).toBeTruthy();
    expect(client.archivedAt).toBeNull();
    expect(client.createdAt).toBe(client.updatedAt);
  });

  it("list() excludes archived clients by default, includes with includeArchived:true", async () => {
    const a = await repo.create({ fullName: "აქტიური", address: "", phone: "", googleMapsLink: "", notes: "" });
    const b = await repo.create({ fullName: "დაარქივებული", address: "", phone: "", googleMapsLink: "", notes: "" });
    await repo.archive(b.id);

    const active = await repo.list();
    expect(active.map((c) => c.id)).toEqual([a.id]);

    const all = await repo.list({ includeArchived: true });
    expect(all).toHaveLength(2);
  });

  it("search() matches by substring, case-insensitively, and excludes archived", async () => {
    await repo.create({ fullName: "Giorgi Maisuradze", address: "", phone: "", googleMapsLink: "", notes: "" });
    const results = await repo.search("maisuradze");
    expect(results).toHaveLength(1);
  });

  it("restore() clears archivedAt", async () => {
    const client = await repo.create({ fullName: "Test", address: "", phone: "", googleMapsLink: "", notes: "" });
    await repo.archive(client.id);
    await repo.restore(client.id);
    const found = await repo.getById(client.id);
    expect(found?.archivedAt).toBeNull();
  });

  it("editing a client changes updatedAt but never createdAt", async () => {
    const client = await repo.create({ fullName: "Original", address: "", phone: "", googleMapsLink: "", notes: "" });
    const originalCreatedAt = client.createdAt;

    await new Promise((r) => setTimeout(r, 5)); // ensure a distinguishable timestamp
    await repo.update(client.id, { fullName: "Renamed" });

    const updated = await repo.getById(client.id);
    expect(updated?.createdAt).toBe(originalCreatedAt);
    expect(updated?.updatedAt).not.toBe(originalCreatedAt);
    expect(updated?.fullName).toBe("Renamed");
  });
});
