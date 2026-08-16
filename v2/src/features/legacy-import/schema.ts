import { z } from "zod";

/** Matches the real, verified V1 export produced by "Export data for V2"
 * in the live app (js/app.js exportV1DataForV2) - see MIGRATION_PLAN.md §3.
 * Deliberately lenient on nested record shapes (V1 fields are all optional/
 * defaultable here) since the export is raw, unmodified getRecords() output
 * and V1 itself tolerates missing optional fields on older records. */

const legacyReportSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  clientName: z.string().default(""),
  address: z.string().default(""),
  phone: z.string().default(""),
  googleMapsLink: z.string().default(""),
  jobDate: z.string().default(""),
  jobDurationDays: z.union([z.string(), z.number()]).default(""),
  groupId: z.string().default(""),
  packageType: z.string().default(""),
  showerTraySize: z.string().default(""),
  antiSlip: z.string().default(""),
  glassPartitionSize: z.string().default(""),
  hingedDoorSize: z.string().default(""),
  panelColor: z.string().default(""),
  floorPanelColor: z.string().default(""),
  panelHeight: z.string().default(""),
  installables: z.array(z.string()).default([]),
  extraWork: z.array(z.string()).default([]),
  workNotes: z.array(z.string()).default([]),
  sketch: z.unknown().nullable().optional(),
  archived: z.boolean().default(false)
});

const legacyGroupSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  createdAt: z.string()
});

const legacyTemplateRecordSchema = z
  .object({
    id: z.string().optional(),
    createdAt: z.string().optional(),
    packageType: z.array(z.string()).default([]),
    antiSlip: z.array(z.string()).default([]),
    showerTraySize: z.array(z.string()).default([]),
    glassPartitionSize: z.array(z.string()).default([]),
    hingedDoorSize: z.array(z.string()).default([]),
    panelColor: z.array(z.string()).default([]),
    floorPanelColor: z.array(z.string()).default([]),
    panelHeight: z.array(z.string()).default([]),
    installables: z.array(z.string()).default([])
  })
  .passthrough();

const legacyTraysItemSchema = z.object({ id: z.string(), note: z.string().default(""), checked: z.boolean().default(false) });
const legacyGlassItemSchema = z.object({
  id: z.string(),
  note: z.string().default(""),
  door: z.string().default(""),
  checked: z.boolean().default(false)
});
const legacyQtyItemSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  qty: z.string().default(""),
  checked: z.boolean().default(false)
});

const legacyLoadingListSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  title: z.string().default(""),
  trays: z.array(legacyTraysItemSchema).default([]),
  glass: z.array(legacyGlassItemSchema).default([]),
  panels: z.array(legacyQtyItemSchema).default([]),
  extras: z.array(legacyQtyItemSchema).default([])
});

const legacyStaySchema = z.object({
  id: z.string(),
  entry: z.string(),
  exit: z.string().nullable()
});

const legacyWorkerSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  createdAt: z.string(),
  stays: z.array(legacyStaySchema).default([])
});

export const legacyExportSchema = z.object({
  format: z.literal("shower-plan-assistant-legacy-export"),
  sourceVersion: z.number(),
  sourceDbVersion: z.number().nullable().optional(),
  exportVersion: z.number(),
  exportId: z.string(),
  exportedAt: z.string(),
  data: z.object({
    reports: z.array(legacyReportSchema).default([]),
    groups: z.array(legacyGroupSchema).default([]),
    templates: z.array(legacyTemplateRecordSchema).default([]),
    loadingLists: z.array(legacyLoadingListSchema).default([]),
    workers: z.array(legacyWorkerSchema).default([])
  })
});

export type LegacyExport = z.infer<typeof legacyExportSchema>;
export type LegacyReport = z.infer<typeof legacyReportSchema>;

/** The only supported legacy export format version right now - gates
 * whether we attempt to import at all. sourceDbVersion is informational
 * only and never gates import (see MIGRATION_PLAN.md §10). */
export const SUPPORTED_SOURCE_VERSION = 1;
