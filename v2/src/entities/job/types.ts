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

/** The three "real" business statuses a Job can have while not archived.
 * Used for `statusBeforeArchive` - see the field doc below and
 * DATA_MODEL.md §2 (Job status preservation). */
export type PreArchiveJobStatus = Exclude<JobStatus, "archived">;

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
  /** Remembers the status the Job had immediately before it was archived, so
   * restoring it returns to exactly that status instead of always forcing
   * "active". Set whenever a non-archived Job transitions to "archived";
   * cleared back to null on restore. Stays null for Jobs that have never
   * been archived, and for legacy/imported archived Jobs where V1 has no
   * equivalent concept - restore() falls back to "active" in that case
   * (never guesses "completed"). See DATA_MODEL.md §2 and
   * MIGRATION_PLAN.md §5. */
  statusBeforeArchive: PreArchiveJobStatus | null;

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

export type NewJobInput = Omit<Job, "id" | "createdAt" | "updatedAt" | "archivedAt" | "clientSnapshot" | "statusBeforeArchive">;
