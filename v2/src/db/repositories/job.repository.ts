import type { AppDatabase } from "@/db/database";
import type { Job, JobStatus, NewJobInput } from "@/entities/job";
import { createId, nowIso } from "@/shared/lib/id";

export interface JobListFilter {
  status?: JobStatus;
  groupId?: string | null;
  limit?: number;
  offset?: number;
}

export interface JobRepository {
  getById(id: string): Promise<Job | undefined>;
  listByGroup(groupId: string, opts?: { status?: JobStatus }): Promise<Job[]>;
  listByClient(clientId: string): Promise<Job[]>;
  listActive(): Promise<Job[]>;
  /** General-purpose filtered + paginated listing for the Jobs list screen.
   * Always queries an index for the status/group filters rather than
   * loading the whole table - see ARCHITECTURE.md §8/§4. */
  list(filter?: JobListFilter): Promise<Job[]>;
  /** Bounded substring search over client name/address, scoped to
   * non-archived jobs only (never a full-table scan) - adequate for
   * Phase 3's "basic search"; the real indexed search engine is Phase 4. */
  search(query: string, opts?: { limit?: number }): Promise<Job[]>;
  countByGroup(groupId: string): Promise<number>;
  create(input: NewJobInput & { clientSnapshot: Job["clientSnapshot"] }): Promise<Job>;
  update(id: string, patch: Partial<Job>): Promise<void>;
  setStatus(id: string, status: JobStatus): Promise<void>;
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

  async list(filter: JobListFilter = {}): Promise<Job[]> {
    const { status, groupId, limit, offset = 0 } = filter;

    let collection;
    if (status && groupId) {
      collection = this.db.jobs.where("[groupId+status]").equals([groupId, status]);
    } else if (status) {
      collection = this.db.jobs.where("status").equals(status);
    } else if (groupId) {
      collection = this.db.jobs.where("groupId").equals(groupId);
    } else {
      collection = this.db.jobs.orderBy("createdAt").reverse();
    }

    if (offset) collection = collection.offset(offset);
    if (limit) collection = collection.limit(limit);

    const results = await collection.toArray();
    // orderBy() above already sorts the unfiltered case; indexed .where()
    // queries don't guarantee order, so sort explicitly (newest first) -
    // cheap since each result page is already bounded by limit.
    return status || groupId ? results.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : results;
  }

  async search(query: string, opts: { limit?: number } = {}): Promise<Job[]> {
    const q = query.trim().toLocaleLowerCase("ka");
    if (!q) return [];
    const limit = opts.limit ?? 20;
    return this.db.jobs
      .filter(
        (job) =>
          job.status !== "archived" &&
          (job.clientSnapshot.fullName.toLocaleLowerCase("ka").includes(q) ||
            job.clientSnapshot.address.toLocaleLowerCase("ka").includes(q))
      )
      .limit(limit)
      .toArray();
  }

  async countByGroup(groupId: string): Promise<number> {
    return this.db.jobs.where("groupId").equals(groupId).count();
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

  async setStatus(id: string, status: JobStatus): Promise<void> {
    const patch: Partial<Job> = { status, updatedAt: nowIso() };
    if (status === "archived") patch.archivedAt = nowIso();
    else patch.archivedAt = null;
    await this.db.jobs.update(id, patch);
  }

  async archive(id: string): Promise<void> {
    await this.setStatus(id, "archived" satisfies JobStatus);
  }

  async restore(id: string): Promise<void> {
    await this.setStatus(id, "active" satisfies JobStatus);
  }

  async delete(id: string): Promise<void> {
    await this.db.jobs.delete(id);
  }
}
