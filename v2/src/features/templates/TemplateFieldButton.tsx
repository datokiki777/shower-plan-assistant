import { useState } from "react";
import type { FieldTemplate, TemplateFieldKey } from "@/entities/template";
import { TEMPLATE_APPEND_FIELDS, TEMPLATE_FIELD_LABELS } from "@/entities/template";
import { TemplatePickerDialog } from "./TemplatePickerDialog";
import "./TemplateFieldButton.css";

export interface TemplateFieldButtonProps {
  fieldKey: TemplateFieldKey;
  templates: FieldTemplate[];
  value: string;
  onChange: (next: string) => void;
}

export function TemplateFieldButton({ fieldKey, templates, value, onChange }: TemplateFieldButtonProps) {
  const [open, setOpen] = useState(false);
  const mode = TEMPLATE_APPEND_FIELDS.has(fieldKey) ? "append" : "single";

  return (
    <>
      <button type="button" className="template-field-button" onClick={() => setOpen(true)}>
        შაბლონები
      </button>
      <TemplatePickerDialog
        open={open}
        onClose={() => setOpen(false)}
        title={TEMPLATE_FIELD_LABELS[fieldKey]}
        templates={templates}
        mode={mode}
        currentValue={value}
        onChange={onChange}
      />
    </>
  );
}
