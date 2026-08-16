import { db, type AppDatabase } from "@/db/database";
import { v2BackupSchema, V2_BACKUP_FORMAT, V2_BACKUP_SCHEMA_VERSION, type V2Backup } from "./schema";

export async function buildBackup(database: AppDatabase = db): Promise<V2Backup> {
  const [clients, jobs, groups, fieldTemplates, loadingLists, loadingItems, workers, stays] = await Promise.all([
    database.clients.toArray(),
    database.jobs.toArray(),
    database.groups.toArray(),
    database.fieldTemplates.toArray(),
    database.loadingLists.toArray(),
    database.loadingItems.toArray(),
    database.workers.toArray(),
    database.stays.toArray()
  ]);
  return {
    format: V2_BACKUP_FORMAT,
    schemaVersion: V2_BACKUP_SCHEMA_VERSION,
    backupId: crypto.randomUUID(),
    exportedAt: new Date().toISOString(),
    data: { clients, jobs, groups, fieldTemplates, loadingLists, loadingItems, workers, stays }
  };
}

export type ParseBackupResult = { ok: true; data: V2Backup } | { ok: false; error: string };

export function parseBackup(rawText: string): ParseBackupResult {
  let json: unknown;
  try {
    json = JSON.parse(rawText);
  } catch {
    return { ok: false, error: "ფაილი არასწორი JSON ფორმატისაა." };
  }
  const parsed = v2BackupSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: "ფაილის სტრუქტურა არ ემთხვევა V2 backup ფორმატს." };
  if (parsed.data.schemaVersion !== V2_BACKUP_SCHEMA_VERSION) {
    return { ok: false, error: `მხარდაუჭერელი schemaVersion: ${parsed.data.schemaVersion}.` };
  }
  // Zod's own inferred type is intentionally loose (passthrough) for
  // validation purposes; the shape is confirmed correct at runtime, so this
  // is a safe assertion to the precise entity-typed shape used everywhere else.
  return { ok: true, data: parsed.data as unknown as V2Backup };
}

/** Destructive restore: clears every table, then writes the backup's data,
 * all inside one transaction (auto-rollback on any failure). Caller is
 * responsible for getting explicit user confirmation first. */
export async function restoreBackup(backup: V2Backup, database: AppDatabase = db): Promise<void> {
  await database.transaction(
    "rw",
    [
      database.clients,
      database.jobs,
      database.groups,
      database.fieldTemplates,
      database.loadingLists,
      database.loadingItems,
      database.workers,
      database.stays
    ],
    async () => {
      await Promise.all([
        database.clients.clear(),
        database.jobs.clear(),
        database.groups.clear(),
        database.fieldTemplates.clear(),
        database.loadingLists.clear(),
        database.loadingItems.clear(),
        database.workers.clear(),
        database.stays.clear()
      ]);
      if (backup.data.clients.length) await database.clients.bulkAdd(backup.data.clients);
      if (backup.data.groups.length) await database.groups.bulkAdd(backup.data.groups);
      if (backup.data.jobs.length) await database.jobs.bulkAdd(backup.data.jobs);
      if (backup.data.fieldTemplates.length) await database.fieldTemplates.bulkAdd(backup.data.fieldTemplates);
      if (backup.data.loadingLists.length) await database.loadingLists.bulkAdd(backup.data.loadingLists);
      if (backup.data.loadingItems.length) await database.loadingItems.bulkAdd(backup.data.loadingItems);
      if (backup.data.workers.length) await database.workers.bulkAdd(backup.data.workers);
      if (backup.data.stays.length) await database.stays.bulkAdd(backup.data.stays);
    }
  );
}
