import type { AppDatabase } from "@/db/database";
import type { Stay, NewStayInput } from "@/entities/stay";
import { createId, nowIso } from "@/shared/lib/id";

export interface StayRepository {
  listByWorker(workerId: string): Promise<Stay[]>;
  create(input: NewStayInput): Promise<Stay>;
  recordExit(id: string, exitDate: string): Promise<void>;
  delete(id: string): Promise<void>;
}

export class LocalStayRepository implements StayRepository {
  private readonly db: AppDatabase;

  constructor(db: AppDatabase) {
    this.db = db;
  }

  async listByWorker(workerId: string): Promise<Stay[]> {
    const stays = await this.db.stays.where("workerId").equals(workerId).toArray();
    return stays.sort((a, b) => b.entryDate.localeCompare(a.entryDate));
  }

  async create(input: NewStayInput): Promise<Stay> {
    const now = nowIso();
    const stay: Stay = { id: createId(), ...input, exitDate: null, createdAt: now, updatedAt: now };
    await this.db.stays.add(stay);
    return stay;
  }

  async recordExit(id: string, exitDate: string): Promise<void> {
    await this.db.stays.update(id, { exitDate, updatedAt: nowIso() });
  }

  async delete(id: string): Promise<void> {
    await this.db.stays.delete(id);
  }
}
