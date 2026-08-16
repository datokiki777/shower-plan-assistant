import { z } from "zod";
import type { Client } from "@/entities/client";
import type { Job } from "@/entities/job";
import type { Group } from "@/entities/group";
import type { FieldTemplate } from "@/entities/template";
import type { LoadingList } from "@/entities/loading-list";
import type { LoadingItem } from "@/entities/loading-item";
import type { Worker } from "@/entities/worker";
import type { Stay } from "@/entities/stay";

export const V2_BACKUP_FORMAT = "shower-plan-assistant-v2-backup";
export const V2_BACKUP_SCHEMA_VERSION = 1;

const entityArraySchema = z.array(z.object({ id: z.string() }).passthrough());

export const v2BackupSchema = z.object({
  format: z.literal(V2_BACKUP_FORMAT),
  schemaVersion: z.number(),
  backupId: z.string(),
  exportedAt: z.string(),
  data: z.object({
    clients: entityArraySchema,
    jobs: entityArraySchema,
    groups: entityArraySchema,
    fieldTemplates: entityArraySchema,
    loadingLists: entityArraySchema,
    loadingItems: entityArraySchema,
    workers: entityArraySchema,
    stays: entityArraySchema
  })
});

/** The real, precisely-typed shape - kept separate from the Zod schema's
 * own inferred type (which is intentionally loose/passthrough for runtime
 * validation). Callers get real entity types after a successful parse. */
export interface V2Backup {
  format: typeof V2_BACKUP_FORMAT;
  schemaVersion: number;
  backupId: string;
  exportedAt: string;
  data: {
    clients: Client[];
    jobs: Job[];
    groups: Group[];
    fieldTemplates: FieldTemplate[];
    loadingLists: LoadingList[];
    loadingItems: LoadingItem[];
    workers: Worker[];
    stays: Stay[];
  };
}
