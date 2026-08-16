import type { AppDatabase } from "@/db/database";
import type { Client, NewClientInput } from "@/entities/client";
import { createId, nowIso } from "@/shared/lib/id";

/** Narrow, query-oriented contract. Components depend on this interface,
 * never on Dexie directly - see ARCHITECTURE.md §3. A future
 * RemoteClientRepository/SyncingClientRepository can implement the same
 * contract without any component changing. */
export interface ClientRepository {
  getById(id: string): Promise<Client | undefined>;
  list(opts?: { includeArchived?: boolean }): Promise<Client[]>;
  search(query: string, opts?: { limit?: number }): Promise<Client[]>;
  create(input: NewClientInput): Promise<Client>;
  update(id: string, patch: Partial<NewClientInput>): Promise<void>;
  archive(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  /** Permanent delete. Only reachable from an explicit archive/history view
   * in the UI, mirroring the lesson already learned in V1 - see
   * OLD_APP_FEATURE_AUDIT.md. */
  delete(id: string): Promise<void>;
}

export class LocalClientRepository implements ClientRepository {
  private readonly db: AppDatabase;

  constructor(db: AppDatabase) {
    this.db = db;
  }

  async getById(id: string): Promise<Client | undefined> {
    return this.db.clients.get(id);
  }

  async list(opts: { includeArchived?: boolean } = {}): Promise<Client[]> {
    const all = await this.db.clients.orderBy("fullName").toArray();
    return opts.includeArchived ? all : all.filter((c) => c.archivedAt === null);
  }

  async search(query: string, opts: { limit?: number } = {}): Promise<Client[]> {
    const q = query.trim().toLocaleLowerCase("ka");
    if (!q) return [];
    const limit = opts.limit ?? 20;
    // Dexie has no native substring index; startsWith-style prefix queries
    // can use `.startsWith()` on an index, but "contains anywhere" (what
    // V1's search does) inherently needs a scan. Bounded and limited here -
    // see ARCHITECTURE.md §8 for when this should move to a real search
    // index (e.g. once dataset size testing in Phase 9 shows it's needed).
    const matches = await this.db.clients
      .filter((c) => c.archivedAt === null && c.fullName.toLocaleLowerCase("ka").includes(q))
      .limit(limit)
      .toArray();
    return matches;
  }

  async create(input: NewClientInput): Promise<Client> {
    const now = nowIso();
    const client: Client = {
      id: createId(),
      ...input,
      createdAt: now,
      updatedAt: now,
      archivedAt: null
    };
    await this.db.clients.add(client);
    return client;
  }

  async update(id: string, patch: Partial<NewClientInput>): Promise<void> {
    await this.db.clients.update(id, { ...patch, updatedAt: nowIso() });
  }

  async archive(id: string): Promise<void> {
    await this.db.clients.update(id, { archivedAt: nowIso(), updatedAt: nowIso() });
  }

  async restore(id: string): Promise<void> {
    await this.db.clients.update(id, { archivedAt: null, updatedAt: nowIso() });
  }

  async delete(id: string): Promise<void> {
    await this.db.clients.delete(id);
  }
}
