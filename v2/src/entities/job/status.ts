import type { JobStatus } from "./types";

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  planned: "დაგეგმილი",
  active: "აქტიური",
  completed: "დასრულებული",
  archived: "დაარქივებული"
};

export const JOB_STATUS_TONES: Record<JobStatus, "brand" | "ok" | "neutral" | "danger"> = {
  planned: "neutral",
  active: "brand",
  completed: "ok",
  archived: "danger"
};

export const JOB_STATUS_ORDER: readonly JobStatus[] = ["planned", "active", "completed", "archived"];
