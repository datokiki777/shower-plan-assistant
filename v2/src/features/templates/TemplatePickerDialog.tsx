import { Dialog } from "@/shared/ui/Dialog";
import { Button } from "@/shared/ui/Button";
import { EmptyState } from "@/shared/ui/EmptyState";
import type { FieldTemplate } from "@/entities/template";
import "./TemplatePickerDialog.css";

export interface TemplatePickerDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  templates: FieldTemplate[];
  mode: "single" | "append";
  /** Single mode: the field's current value. Append mode: the raw
   * newline-separated textarea text. */
  currentValue: string;
  onChange: (nextValue: string) => void;
}

function textToLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function TemplatePickerDialog({ open, onClose, title, templates, mode, currentValue, onChange }: TemplatePickerDialogProps) {
  const pickedLines = mode === "append" ? textToLines(currentValue) : [];

  const handlePick = (value: string) => {
    if (mode === "single") {
      onChange(value);
      onClose();
      return;
    }
    const isPicked = pickedLines.includes(value);
    const nextLines = isPicked ? pickedLines.filter((l) => l !== value) : [...pickedLines, value];
    onChange(nextLines.join("\n"));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={<Button onClick={onClose}>დახურვა</Button>}
    >
      <p className="template-picker__hint">
        {mode === "append"
          ? "დააჭირე ერთს ან რამდენიმეს - ემატება ახალ ხაზად. კიდევ ერთხელ დააჭირე იმავეს რომ ამოშალო."
          : "აირჩიე შაბლონი - ჩაიწერება ველში, შემდეგ თუ გინდა შეგიძლია თავად გადააკეთო."}
      </p>
      {templates.length === 0 ? (
        <EmptyState title="შაბლონები ჯერ არ არის დამატებული" description="დაამატე „შაბლონები“ გვერდზე." />
      ) : (
        <div className="template-picker__list">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`template-picker__option${pickedLines.includes(t.value) ? " template-picker__option--picked" : ""}`}
              onClick={() => handlePick(t.value)}
            >
              {t.value}
            </button>
          ))}
        </div>
      )}
    </Dialog>
  );
}
