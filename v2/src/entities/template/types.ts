/** See DATA_MODEL.md §4. One row per template value (V1 stored one
 * array-of-strings per field inside a single wrapper record). */
export type TemplateFieldKey =
  | "packageType"
  | "antiSlip"
  | "showerTraySize"
  | "glassPartitionSize"
  | "hingedDoorSize"
  | "panelColor"
  | "floorPanelColor"
  | "panelHeight"
  | "installables";

export const TEMPLATE_FIELD_KEYS: readonly TemplateFieldKey[] = [
  "packageType",
  "antiSlip",
  "showerTraySize",
  "glassPartitionSize",
  "hingedDoorSize",
  "panelColor",
  "floorPanelColor",
  "panelHeight",
  "installables"
];

/** Fields where picking a template appends a new value instead of replacing
 * the whole field. A fixed, code-reviewed list, not user-configurable data -
 * matches V1's TEMPLATE_APPEND_FIELDS - see DATA_MODEL.md §4. */
export const TEMPLATE_APPEND_FIELDS: ReadonlySet<TemplateFieldKey> = new Set([
  "glassPartitionSize",
  "installables"
]);

export interface FieldTemplate {
  id: string;
  fieldKey: TemplateFieldKey;
  value: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type NewFieldTemplateInput = Pick<FieldTemplate, "fieldKey" | "value">;
