/**
 * See DATA_MODEL.md §2.
 *
 * Migration compatibility (do not change silently - see MIGRATION_PLAN.md §5):
 * - `id` must be able to hold a preserved V1 `reports.id`.
 * - Migrated jobs are only ever assigned "active" or "archived" (mapped
 *   directly from V1 `archived: false`/`true`). "planned" and "completed"
 *   are only ever set by user action on jobs created in V2.
 */
export type JobStatus = "planned" | "active" | "completed" | "archived";

export interface JobClientSnapshot {
  fullName: string;
  address: string;
  phone: string;
}

export interface Job {
  id: string;
  clientId: string;
  groupId: string | null;

  status: JobStatus;

  jobDate: string | null; // "YYYY-MM-DD" or null
  jobDurationDays: number | null;

  packageType: string;
  antiSlip: string;
  showerTraySize: string;

  /** String array, not a single string with embedded newlines like V1 - see DATA_MODEL.md §2. */
  glassPartitionSize: string[];
  hingedDoorSize: string;

  panelColor: string;
  floorPanelColor: string;
  panelHeight: string;

  installables: string[];
  extraWork: string[];
  workNotes: string[];

  /** Populated from the Client at job-creation time; never auto-updated when
   * the live Client changes later - see DATA_MODEL.md §2. */
  clientSnapshot: JobClientSnapshot;

  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export type NewJobInput = Omit<Job, "id" | "createdAt" | "updatedAt" | "archivedAt" | "clientSnapshot">;
