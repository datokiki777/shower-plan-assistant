import type { AppDatabase } from "@/db/database";
import type { Worker, NewWorkerInput } from "@/entities/worker";
import { createId, nowIso } from "@/shared/lib/id";

export interface WorkerRepository {
  getById(id: string): Promise<Worker | undefined>;
  list(opts?: { includeArchived?: boolean }): Promise<Worker[]>;
  create(input: NewWorkerInput): Promise<Worker>;
  archive(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  delete(id: string): Promise<void>;
}

export class LocalWorkerRepository implements WorkerRepository {
  private readonly db: AppDatabase;

  constructor(db: AppDatabase) {
    this.db = db;
  }

  async getById(id: string): Promise<Worker | undefined> {
    return this.db.workers.get(id);
  }

  async list(opts: { includeArchived?: boolean } = {}): Promise<Worker[]> {
    const all = await this.db.workers.toArray();
    const filtered = opts.includeArchived ? all : all.filter((w) => w.archivedAt === null);
    return filtered.sort((a, b) => a.name.localeCompare(b.name, "ka"));
  }

  async create(input: NewWorkerInput): Promise<Worker> {
    const now = nowIso();
    const worker: Worker = { id: createId(), ...input, createdAt: now, updatedAt: now, archivedAt: null };
    await this.db.workers.add(worker);
    return worker;
  }

  async archive(id: string): Promise<void> {
    await this.db.workers.update(id, { archivedAt: nowIso(), updatedAt: nowIso() });
  }

  async restore(id: string): Promise<void> {
    await this.db.workers.update(id, { archivedAt: null, updatedAt: nowIso() });
  }

  async delete(id: string): Promise<void> {
    await this.db.transaction("rw", this.db.workers, this.db.stays, async () => {
      await this.db.stays.where("workerId").equals(id).delete();
      await this.db.workers.delete(id);
    });
  }
}
