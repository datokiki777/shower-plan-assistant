/** See DATA_MODEL.md §7 and MIGRATION_PLAN.md §8 (duplicate-import protection). */
export interface MigrationRecord {
  id: string;
  source: "shower-plan-assistant-v1";
  sourceExportId: string;
  sourceVersion: number;
  sourceDbVersion: number | null;
  importedAt: string;
  originalExportedAt: string;
  recordCounts: Record<string, number>;
  warnings: string[];
}
