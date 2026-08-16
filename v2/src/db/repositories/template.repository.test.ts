import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { AppDatabase } from "@/db/database";
import { LocalTemplateRepository } from "@/db/repositories/template.repository";

describe("LocalTemplateRepository", () => {
  let testDb: AppDatabase;
  let repo: LocalTemplateRepository;

  beforeEach(() => {
    testDb = new AppDatabase(`test-${crypto.randomUUID()}`);
    repo = new LocalTemplateRepository(testDb);
  });

  afterEach(async () => {
    testDb.close();
    await testDb.delete();
  });

  it("creates templates with increasing sortOrder and lists them in that order", async () => {
    await repo.create({ fieldKey: "packageType", value: "S" });
    await repo.create({ fieldKey: "packageType", value: "M" });
    await repo.create({ fieldKey: "packageType", value: "L" });

    const list = await repo.listByField("packageType");
    expect(list.map((t) => t.value)).toEqual(["S", "M", "L"]);
    expect(list.map((t) => t.sortOrder)).toEqual([0, 1, 2]);
  });

  it("listByField only returns templates for that exact field", async () => {
    await repo.create({ fieldKey: "packageType", value: "S" });
    await repo.create({ fieldKey: "antiSlip", value: "დიახ" });
    expect((await repo.listByField("packageType")).map((t) => t.value)).toEqual(["S"]);
    expect((await repo.listByField("antiSlip")).map((t) => t.value)).toEqual(["დიახ"]);
  });

  it("reorder() persists a new order that listByField then reflects", async () => {
    const s = await repo.create({ fieldKey: "packageType", value: "S" });
    const m = await repo.create({ fieldKey: "packageType", value: "M" });
    const l = await repo.create({ fieldKey: "packageType", value: "L" });

    await repo.reorder("packageType", [l.id, s.id, m.id]);

    const list = await repo.listByField("packageType");
    expect(list.map((t) => t.value)).toEqual(["L", "S", "M"]);
  });

  it("delete() removes only the targeted template", async () => {
    const s = await repo.create({ fieldKey: "packageType", value: "S" });
    const m = await repo.create({ fieldKey: "packageType", value: "M" });
    await repo.delete(s.id);
    const list = await repo.listByField("packageType");
    expect(list.map((t) => t.id)).toEqual([m.id]);
  });
});
