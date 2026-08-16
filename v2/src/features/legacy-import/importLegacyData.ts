import { db, type AppDatabase } from "@/db/database";
import { legacyExportSchema, SUPPORTED_SOURCE_VERSION, type LegacyExport } from "./schema";
import { transformV1ToV2, type TransformResult } from "./transform";
import type { MigrationRecord } from "@/entities/migration-record";

export type ParseResult = { ok: true; data: LegacyExport } | { ok: false; error: string };

export function parseLegacyExport(rawText: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(rawText);
  } catch {
    return { ok: false, error: "ფაილი არასწორი JSON ფორმატისაა." };
  }
  const parsed = legacyExportSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, error: "ფაილის სტრუქტურა არ ემთხვევა V1 ექსპორტის ფორმატს." };
  }
  if (parsed.data.sourceVersion !== SUPPORTED_SOURCE_VERSION) {
    return { ok: false, error: `მხარდაუჭერელი sourceVersion: ${parsed.data.sourceVersion} (მოსალოდნელი: ${SUPPORTED_SOURCE_VERSION}).` };
  }
  return { ok: true, data: parsed.data };
}

export async function findExistingImport(exportId: string, database: AppDatabase = db): Promise<MigrationRecord | undefined> {
  return database.migrationRecords.where("sourceExportId").equals(exportId).first();
}

export function buildPreview(legacyExport: LegacyExport): TransformResult {
  return transformV1ToV2(legacyExport.data);
}

/**
 * Writes everything inside one Dexie transaction across every affected
 * table - either the whole import succeeds, or (on any thrown error) Dexie
 * automatically rolls back and the database is left exactly as it was
 * before the import started. See MIGRATION_PLAN.md §9.
 */
export async function runLegacyImport(
  legacyExport: LegacyExport,
  result: TransformResult,
  database: AppDatabase = db
): Promise<MigrationRecord> {
  return database.transaction(
    "rw",
    [
      database.clients,
      database.jobs,
      database.groups,
      database.fieldTemplates,
      database.loadingLists,
      database.loadingItems,
      database.workers,
      database.stays,
      database.migrationRecords
    ],
    async () => {
      if (result.clients.length) await database.clients.bulkAdd(result.clients);
      if (result.groups.length) await database.groups.bulkAdd(result.groups);
      if (result.jobs.length) await database.jobs.bulkAdd(result.jobs);
      if (result.fieldTemplates.length) await database.fieldTemplates.bulkAdd(result.fieldTemplates);
      if (result.loadingLists.length) await database.loadingLists.bulkAdd(result.loadingLists);
      if (result.loadingItems.length) await database.loadingItems.bulkAdd(result.loadingItems);
      if (result.workers.length) await database.workers.bulkAdd(result.workers);
      if (result.stays.length) await database.stays.bulkAdd(result.stays);

      const record: MigrationRecord = {
        id: crypto.randomUUID(),
        source: "shower-plan-assistant-v1",
        sourceExportId: legacyExport.exportId,
        sourceVersion: legacyExport.sourceVersion,
        sourceDbVersion: legacyExport.sourceDbVersion ?? null,
        importedAt: new Date().toISOString(),
        originalExportedAt: legacyExport.exportedAt,
        recordCounts: result.counts,
        warnings: result.warnings
      };
      await database.migrationRecords.add(record);
      return record;
    }
  );
}
