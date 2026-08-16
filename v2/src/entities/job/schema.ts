import { z } from "zod";
import { isDateOnlyString } from "@/shared/lib/date";

export const jobFormSchema = z.object({
  clientId: z.string().trim().min(1, "კლიენტი აუცილებელია"),
  groupId: z.string().trim().min(1, "ჯგუფი აუცილებელია"),
  jobDate: z
    .string()
    .trim()
    .refine((v) => v === "" || isDateOnlyString(v), "თარიღის ფორმატი არასწორია"),
  jobDurationDays: z.string().trim(), // "" or "1".."7" from a <select>, parsed on submit
  packageType: z.string().trim(),
  antiSlip: z.string().trim(),
  showerTraySize: z.string().trim(),
  glassPartitionSizeText: z.string(), // newline-separated, see jobFormToInput()
  hingedDoorSize: z.string().trim(),
  panelColor: z.string().trim(),
  floorPanelColor: z.string().trim(),
  panelHeight: z.string().trim(),
  installablesText: z.string(),
  extraWorkText: z.string(),
  workNotesText: z.string()
});

export type JobFormValues = z.infer<typeof jobFormSchema>;

export const JOB_FORM_DEFAULTS: JobFormValues = {
  clientId: "",
  groupId: "",
  jobDate: "",
  jobDurationDays: "",
  packageType: "",
  antiSlip: "",
  showerTraySize: "",
  glassPartitionSizeText: "",
  hingedDoorSize: "",
  panelColor: "",
  floorPanelColor: "",
  panelHeight: "",
  installablesText: "",
  extraWorkText: "",
  workNotesText: ""
};

function textToLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function linesToText(lines: string[]): string {
  return lines.join("\n");
}

/** Converts submitted form values into the persisted-shape fields (excludes
 * id/status/clientSnapshot/timestamps, which the caller supplies). */
export function jobFormToPersistedFields(values: JobFormValues) {
  return {
    clientId: values.clientId,
    groupId: values.groupId || null,
    jobDate: values.jobDate || null,
    jobDurationDays: values.jobDurationDays ? Number(values.jobDurationDays) : null,
    packageType: values.packageType,
    antiSlip: values.antiSlip,
    showerTraySize: values.showerTraySize,
    glassPartitionSize: textToLines(values.glassPartitionSizeText),
    hingedDoorSize: values.hingedDoorSize,
    panelColor: values.panelColor,
    floorPanelColor: values.floorPanelColor,
    panelHeight: values.panelHeight,
    installables: textToLines(values.installablesText),
    extraWork: textToLines(values.extraWorkText),
    workNotes: textToLines(values.workNotesText)
  };
}

/** The inverse - used to populate the edit form from a persisted Job. */
export function jobToFormValues(job: {
  clientId: string;
  groupId: string | null;
  jobDate: string | null;
  jobDurationDays: number | null;
  packageType: string;
  antiSlip: string;
  showerTraySize: string;
  glassPartitionSize: string[];
  hingedDoorSize: string;
  panelColor: string;
  floorPanelColor: string;
  panelHeight: string;
  installables: string[];
  extraWork: string[];
  workNotes: string[];
}): JobFormValues {
  return {
    clientId: job.clientId,
    groupId: job.groupId ?? "",
    jobDate: job.jobDate ?? "",
    jobDurationDays: job.jobDurationDays ? String(job.jobDurationDays) : "",
    packageType: job.packageType,
    antiSlip: job.antiSlip,
    showerTraySize: job.showerTraySize,
    glassPartitionSizeText: linesToText(job.glassPartitionSize),
    hingedDoorSize: job.hingedDoorSize,
    panelColor: job.panelColor,
    floorPanelColor: job.floorPanelColor,
    panelHeight: job.panelHeight,
    installablesText: linesToText(job.installables),
    extraWorkText: linesToText(job.extraWork),
    workNotesText: linesToText(job.workNotes)
  };
}
