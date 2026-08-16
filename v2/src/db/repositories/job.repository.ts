import type { AppDatabase } from "@/db/database";
import type { Job, JobStatus, NewJobInput } from "@/entities/job";
import { createId, nowIso } from "@/shared/lib/id";

export interface JobRepository {
  getById(id: string): Promise<Job | undefined>;
  listByGroup(groupId: string, opts?: { status?: JobStatus }): Promise<Job[]>;
  listByClient(clientId: string): Promise<Job[]>;
  listActive(): Promise<Job[]>;
  create(input: NewJobInput & { clientSnapshot: Job["clientSnapshot"] }): Promise<Job>;
  update(id: string, patch: Partial<Job>): Promise<void>;
  archive(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  delete(id: string): Promise<void>;
}

export class LocalJobRepository implements JobRepository {
  private readonly db: AppDatabase;

  constructor(db: AppDatabase) {
    this.db = db;
  }

  async getById(id: string): Promise<Job | undefined> {
    return this.db.jobs.get(id);
  }

  async listByGroup(groupId: string, opts: { status?: JobStatus } = {}): Promise<Job[]> {
    if (opts.status) {
      return this.db.jobs.where("[groupId+status]").equals([groupId, opts.status]).toArray();
    }
    return this.db.jobs.where("groupId").equals(groupId).toArray();
  }

  async listByClient(clientId: string): Promise<Job[]> {
    return this.db.jobs.where("clientId").equals(clientId).toArray();
  }

  async listActive(): Promise<Job[]> {
    return this.db.jobs.where("status").equals("active" satisfies JobStatus).toArray();
  }

  async create(input: NewJobInput & { clientSnapshot: Job["clientSnapshot"] }): Promise<Job> {
    const now = nowIso();
    const job: Job = {
      id: createId(),
      ...input,
      createdAt: now,
      updatedAt: now,
      archivedAt: null
    };
    await this.db.jobs.add(job);
    return job;
  }

  async update(id: string, patch: Partial<Job>): Promise<void> {
    await this.db.jobs.update(id, { ...patch, updatedAt: nowIso() });
  }

  async archive(id: string): Promise<void> {
    await this.db.jobs.update(id, { status: "archived" satisfies JobStatus, archivedAt: nowIso(), updatedAt: nowIso() });
  }

  async restore(id: string): Promise<void> {
    await this.db.jobs.update(id, { status: "active" satisfies JobStatus, archivedAt: null, updatedAt: nowIso() });
  }

  async delete(id: string): Promise<void> {
    await this.db.jobs.delete(id);
  }
}
