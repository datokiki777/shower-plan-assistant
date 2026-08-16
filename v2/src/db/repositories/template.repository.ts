import Dexie from "dexie";
import type { AppDatabase } from "@/db/database";
import type { FieldTemplate, NewFieldTemplateInput, TemplateFieldKey } from "@/entities/template";
import { createId, nowIso } from "@/shared/lib/id";

export interface TemplateRepository {
  listByField(fieldKey: TemplateFieldKey): Promise<FieldTemplate[]>;
  create(input: NewFieldTemplateInput): Promise<FieldTemplate>;
  /** Persists a full reorder for one field's templates in one go (matches
   * the up/down-arrow reorder UX already proven in V1). */
  reorder(fieldKey: TemplateFieldKey, orderedIds: string[]): Promise<void>;
  delete(id: string): Promise<void>;
}

export class LocalTemplateRepository implements TemplateRepository {
  private readonly db: AppDatabase;

  constructor(db: AppDatabase) {
    this.db = db;
  }

  async listByField(fieldKey: TemplateFieldKey): Promise<FieldTemplate[]> {
    return this.db.fieldTemplates.where("[fieldKey+sortOrder]").between([fieldKey, Dexie.minKey], [fieldKey, Dexie.maxKey]).toArray();
  }

  async create(input: NewFieldTemplateInput): Promise<FieldTemplate> {
    const existing = await this.listByField(input.fieldKey);
    const now = nowIso();
    const template: FieldTemplate = {
      id: createId(),
      ...input,
      sortOrder: existing.length,
      createdAt: now,
      updatedAt: now
    };
    await this.db.fieldTemplates.add(template);
    return template;
  }

  async reorder(_fieldKey: TemplateFieldKey, orderedIds: string[]): Promise<void> {
    await this.db.transaction("rw", this.db.fieldTemplates, async () => {
      await Promise.all(
        orderedIds.map((id, index) => this.db.fieldTemplates.update(id, { sortOrder: index, updatedAt: nowIso() }))
      );
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.fieldTemplates.delete(id);
  }
}
