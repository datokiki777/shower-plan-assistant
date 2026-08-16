import type { AppDatabase } from "@/db/database";
import type { LoadingList, NewLoadingListInput } from "@/entities/loading-list";
import type { LoadingItem, NewLoadingItemInput } from "@/entities/loading-item";
import { createId, nowIso } from "@/shared/lib/id";

export interface LoadingRepository {
  listLists(opts?: { includeArchived?: boolean }): Promise<LoadingList[]>;
  getList(id: string): Promise<LoadingList | undefined>;
  createList(input: NewLoadingListInput): Promise<LoadingList>;
  renameList(id: string, title: string): Promise<void>;
  archiveList(id: string): Promise<void>;
  restoreList(id: string): Promise<void>;
  deleteList(id: string): Promise<void>;
  duplicateList(id: string): Promise<LoadingList>;
  searchLists(query: string, opts?: { limit?: number }): Promise<LoadingList[]>;

  listItems(loadingListId: string): Promise<LoadingItem[]>;
  addItem(input: NewLoadingItemInput): Promise<LoadingItem>;
  updateItem(id: string, patch: Partial<LoadingItem>): Promise<void>;
  deleteItem(id: string): Promise<void>;
}

export class LocalLoadingRepository implements LoadingRepository {
  private readonly db: AppDatabase;

  constructor(db: AppDatabase) {
    this.db = db;
  }

  async listLists(opts: { includeArchived?: boolean } = {}): Promise<LoadingList[]> {
    const all = await this.db.loadingLists.orderBy("createdAt").reverse().toArray();
    return opts.includeArchived ? all : all.filter((l) => l.archivedAt === null);
  }

  async getList(id: string): Promise<LoadingList | undefined> {
    return this.db.loadingLists.get(id);
  }

  async createList(input: NewLoadingListInput): Promise<LoadingList> {
    const now = nowIso();
    const list: LoadingList = { id: createId(), ...input, createdAt: now, updatedAt: now, archivedAt: null };
    await this.db.loadingLists.add(list);
    return list;
  }

  async renameList(id: string, title: string): Promise<void> {
    await this.db.loadingLists.update(id, { title, updatedAt: nowIso() });
  }

  async archiveList(id: string): Promise<void> {
    await this.db.loadingLists.update(id, { archivedAt: nowIso(), updatedAt: nowIso() });
  }

  async restoreList(id: string): Promise<void> {
    await this.db.loadingLists.update(id, { archivedAt: null, updatedAt: nowIso() });
  }

  async duplicateList(id: string): Promise<LoadingList> {
    const original = await this.getList(id);
    if (!original) throw new Error(`Loading list ${id} not found`);
    const items = await this.listItems(id);
    const copy = await this.createList({ title: `${original.title} (ასლი)` });
    for (const item of items) {
      await this.addItem({
        loadingListId: copy.id,
        category: item.category,
        name: item.name,
        note: item.note,
        quantity: item.quantity,
        doorInfo: item.doorInfo
      });
    }
    return copy;
  }

  async searchLists(query: string, opts: { limit?: number } = {}): Promise<LoadingList[]> {
    const q = query.trim().toLocaleLowerCase("ka");
    if (!q) return [];
    const limit = opts.limit ?? 20;
    return this.db.loadingLists
      .filter((l) => l.archivedAt === null && l.title.toLocaleLowerCase("ka").includes(q))
      .limit(limit)
      .toArray();
  }

  async deleteList(id: string): Promise<void> {
    await this.db.transaction("rw", this.db.loadingLists, this.db.loadingItems, async () => {
      await this.db.loadingItems.where("loadingListId").equals(id).delete();
      await this.db.loadingLists.delete(id);
    });
  }

  async listItems(loadingListId: string): Promise<LoadingItem[]> {
    const items = await this.db.loadingItems.where("loadingListId").equals(loadingListId).toArray();
    return items.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async addItem(input: NewLoadingItemInput): Promise<LoadingItem> {
    const existing = await this.listItems(input.loadingListId);
    const now = nowIso();
    const item: LoadingItem = {
      id: createId(),
      name: "",
      note: "",
      quantity: null,
      doorInfo: null,
      checked: false,
      ...input,
      sortOrder: existing.length,
      createdAt: now,
      updatedAt: now
    };
    await this.db.loadingItems.add(item);
    return item;
  }

  async updateItem(id: string, patch: Partial<LoadingItem>): Promise<void> {
    await this.db.loadingItems.update(id, { ...patch, updatedAt: nowIso() });
  }

  async deleteItem(id: string): Promise<void> {
    await this.db.loadingItems.delete(id);
  }
}
