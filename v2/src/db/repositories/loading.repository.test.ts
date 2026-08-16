import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { AppDatabase } from "@/db/database";
import { LocalLoadingRepository } from "@/db/repositories/loading.repository";

describe("LocalLoadingRepository", () => {
  let testDb: AppDatabase;
  let repo: LocalLoadingRepository;

  beforeEach(() => {
    testDb = new AppDatabase(`test-${crypto.randomUUID()}`);
    repo = new LocalLoadingRepository(testDb);
  });

  afterEach(async () => {
    testDb.close();
    await testDb.delete();
  });

  it("creates a list and items, listItems returns them sorted by sortOrder", async () => {
    const list = await repo.createList({ title: "სია A" });
    await repo.addItem({ loadingListId: list.id, category: "panels", name: "პანელი 1" });
    await repo.addItem({ loadingListId: list.id, category: "panels", name: "პანელი 2" });
    const items = await repo.listItems(list.id);
    expect(items.map((i) => i.name)).toEqual(["პანელი 1", "პანელი 2"]);
  });

  it("archiveList/restoreList round-trips archivedAt", async () => {
    const list = await repo.createList({ title: "სია" });
    await repo.archiveList(list.id);
    expect((await repo.getList(list.id))?.archivedAt).not.toBeNull();
    await repo.restoreList(list.id);
    expect((await repo.getList(list.id))?.archivedAt).toBeNull();
  });

  it("duplicateList copies title (with suffix) and all items into a new list", async () => {
    const original = await repo.createList({ title: "ორიგინალი" });
    await repo.addItem({ loadingListId: original.id, category: "glass", note: "შუშა 100სმ", doorInfo: "PK90" });
    await repo.addItem({ loadingListId: original.id, category: "extras", name: "დამატება", quantity: "2" });

    const copy = await repo.duplicateList(original.id);
    expect(copy.id).not.toBe(original.id);
    expect(copy.title).toContain("ორიგინალი");

    const copiedItems = await repo.listItems(copy.id);
    expect(copiedItems).toHaveLength(2);
    expect(copiedItems.every((i) => i.loadingListId === copy.id)).toBe(true);
    expect(await repo.listItems(original.id)).toHaveLength(2);
  });

  it("deleteList also deletes its items (no orphans)", async () => {
    const list = await repo.createList({ title: "სია" });
    await repo.addItem({ loadingListId: list.id, category: "trays", note: "თასი" });
    await repo.deleteList(list.id);
    expect(await repo.listItems(list.id)).toHaveLength(0);
  });

  it("searchLists matches by title, excludes archived", async () => {
    await repo.createList({ title: "გიორგის სახლი" });
    const archived = await repo.createList({ title: "გიორგის ბინა" });
    await repo.archiveList(archived.id);

    const results = await repo.searchLists("გიორგი");
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("გიორგის სახლი");
  });
});
