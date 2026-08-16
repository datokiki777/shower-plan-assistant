import { useState } from "react";
import { Card } from "@/shared/ui/Card";
import { Input } from "@/shared/ui/fields";
import { Button } from "@/shared/ui/Button";
import { IconButton } from "@/shared/ui/IconButton";
import { templateRepository } from "@/db/repositories";
import { TEMPLATE_FIELD_LABELS, type FieldTemplate, type TemplateFieldKey } from "@/entities/template";
import "./TemplateFieldCard.css";

export interface TemplateFieldCardProps {
  fieldKey: TemplateFieldKey;
  templates: FieldTemplate[];
  onChanged: () => void;
}

export function TemplateFieldCard({ fieldKey, templates, onChanged }: TemplateFieldCardProps) {
  const [newValue, setNewValue] = useState("");

  const handleAdd = async () => {
    const value = newValue.trim();
    if (!value) return;
    if (templates.some((t) => t.value === value)) {
      setNewValue("");
      return;
    }
    await templateRepository.create({ fieldKey, value });
    setNewValue("");
    onChanged();
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= templates.length) return;
    const reordered = [...templates];
    const moved = reordered[index]!;
    reordered[index] = reordered[targetIndex]!;
    reordered[targetIndex] = moved;
    await templateRepository.reorder(fieldKey, reordered.map((t) => t.id));
    onChanged();
  };

  const handleDelete = async (id: string) => {
    await templateRepository.delete(id);
    onChanged();
  };

  return (
    <Card className="template-field-card">
      <div className="template-field-card__head">
        <strong>{TEMPLATE_FIELD_LABELS[fieldKey]}</strong>
        <span className="template-field-card__count">{templates.length} შაბლონი</span>
      </div>

      <div className="template-field-card__chips">
        {templates.length === 0 && <span className="template-field-card__empty">შაბლონები ჯერ არ არის</span>}
        {templates.map((t, index) => (
          <span key={t.id} className="template-field-card__chip">
            <IconButton label="ზემოთ" onClick={() => void handleMove(index, -1)} disabled={index === 0}>
              ▲
            </IconButton>
            <IconButton label="ქვემოთ" onClick={() => void handleMove(index, 1)} disabled={index === templates.length - 1}>
              ▼
            </IconButton>
            {t.value}
            <IconButton label="წაშლა" onClick={() => void handleDelete(t.id)}>
              ×
            </IconButton>
          </span>
        ))}
      </div>

      <div className="template-field-card__add-row">
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleAdd();
            }
          }}
          placeholder="ახალი შაბლონის დამატება"
        />
        <Button onClick={() => void handleAdd()}>+ დამატება</Button>
      </div>
    </Card>
  );
}
