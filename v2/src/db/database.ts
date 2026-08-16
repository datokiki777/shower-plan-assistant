import Dexie, { type EntityTable } from "dexie";
import type { Client } from "@/entities/client";
import type { Job } from "@/entities/job";
import type { Group } from "@/entities/group";
import type { FieldTemplate } from "@/entities/template";
import type { LoadingList } from "@/entities/loading-list";
import type { LoadingItem } from "@/entities/loading-item";
import type { Worker } from "@/entities/worker";
import type { Stay } from "@/entities/stay";
import type { MigrationRecord } from "@/entities/migration-record";

/**
 * V2's database name is deliberately different from V1's ("shower-plan-assistant")
 * so the two never collide and V1 stays fully recoverable/untouched - see
 * MIGRATION_PLAN.md and the Phase 2 brief. Application code must never open
 * "shower-plan-assistant" (V1's database) in read/write mode; the legacy
 * importer (a later phase) reads V1 data only from the exported JSON file,
 * never live from V1's IndexedDB.
 */
export const V2_DB_NAME = "shower-plan-assistant-v2";

export class AppDatabase extends Dexie {
  clients!: EntityTable<Client, "id">;
  jobs!: EntityTable<Job, "id">;
  groups!: EntityTable<Group, "id">;
  fieldTemplates!: EntityTable<FieldTemplate, "id">;
  loadingLists!: EntityTable<LoadingList, "id">;
  loadingItems!: EntityTable<LoadingItem, "id">;
  workers!: EntityTable<Worker, "id">;
  stays!: EntityTable<Stay, "id">;
  migrationRecords!: EntityTable<MigrationRecord, "id">;

  constructor(name: string = V2_DB_NAME) {
    super(name);

    // Schema version 1. Every future schema change is a NEW db.version(n)
    // block below this one - never edit this block directly once it has
    // shipped. See ARCHITECTURE.md §4 and DATA_MODEL.md §8 for the index
    // choices and why each one is justified by an actual query pattern
    // (never over-indexed - see the Phase 2 brief).
    this.version(1).stores({
      clients: "id, fullName, archivedAt",
      jobs: "id, clientId, groupId, status, jobDate, [groupId+status]",
      groups: "id, name, archivedAt",
      fieldTemplates: "id, fieldKey, [fieldKey+sortOrder]",
      loadingLists: "id, archivedAt",
      loadingItems: "id, loadingListId, [loadingListId+category]",
      workers: "id, archivedAt",
      stays: "id, workerId, [workerId+entryDate]",
      migrationRecords: "id, sourceExportId"
    });

    // Version 2: adds Job.statusBeforeArchive so archive/restore preserves
    // the Job's real business status (planned/active/completed) instead of
    // always forcing "active" on restore - see entities/job/types.ts and
    // DATA_MODEL.md §2. No index change (the field isn't queried on), so
    // only an upgrade() is needed, not a new .stores() definition - existing
    // jobs are backfilled with statusBeforeArchive: null (the same "no
    // remembered prior status" value new/legacy-imported archived Jobs get;
    // restore() falls back to "active" for those, never guesses "completed").
    this.version(2).upgrade(async (tx) => {
      await tx
        .table("jobs")
        .toCollection()
        .modify((job: { statusBeforeArchive?: unknown }) => {
          if (job.statusBeforeArchive === undefined) {
            job.statusBeforeArchive = null;
          }
        });
    });
  }
}

/** Shared singleton instance used by the app at runtime. Tests construct
 * their own AppDatabase instance (with a unique name) instead of importing
 * this, so tests never share state with each other or with dev data. */
export const db = new AppDatabase();
