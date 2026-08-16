import type { AppDatabase } from "@/db/database";
import type { MigrationRecord } from "@/entities/migration-record";
import { createId, nowIso } from "@/shared/lib/id";

export interface MigrationRepository {
  findByExportId(exportId: string): Promise<MigrationRecord | undefined>;
  record(input: Omit<MigrationRecord, "id" | "importedAt">): Promise<MigrationRecord>;
}

export class LocalMigrationRepository implements MigrationRepository {
  private readonly db: AppDatabase;

  constructor(db: AppDatabase) {
    this.db = db;
  }

  async findByExportId(exportId: string): Promise<MigrationRecord | undefined> {
    return this.db.migrationRecords.where("sourceExportId").equals(exportId).first();
  }

  async record(input: Omit<MigrationRecord, "id" | "importedAt">): Promise<MigrationRecord> {
    const record: MigrationRecord = { id: createId(), importedAt: nowIso(), ...input };
    await this.db.migrationRecords.add(record);
    return record;
  }
}
