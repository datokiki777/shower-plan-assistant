import { useEffect, useState } from "react";
import { Dialog } from "@/shared/ui/Dialog";
import { Button } from "@/shared/ui/Button";
import { IconButton } from "@/shared/ui/IconButton";
import { Input } from "@/shared/ui/fields";
import { useToast } from "@/shared/ui/Toast";
import { loadingRepository } from "@/db/repositories";
import type { LoadingList } from "@/entities/loading-list";
import type { LoadingCategory } from "@/entities/loading-item";
import "./LoadingListDialog.css";

interface Draft {
  key: string; // client-side only, for React list keys
  name: string;
  note: string;
  quantity: string;
  doorInfo: string;
  checked: boolean;
}

function emptyDraft(): Draft {
  return { key: crypto.randomUUID(), name: "", note: "", quantity: "", doorInfo: "", checked: false };
}

const CATEGORIES: Array<{ key: LoadingCategory; label: string; hasName: boolean; hasDoor: boolean }> = [
  { key: "trays", label: "შუშის თასები", hasName: false, hasDoor: false },
  { key: "glass", label: "შუშა", hasName: false, hasDoor: true },
  { key: "panels", label: "პანელები", hasName: true, hasDoor: false },
  { key: "extras", label: "დამატებითი", hasName: true, hasDoor: false }
];

export interface LoadingListDialogProps {
  open: boolean;
  onClose: () => void;
  list?: LoadingList | null;
  onSaved: () => void;
}

export function LoadingListDialog({ open, onClose, list, onSaved }: LoadingListDialogProps) {
  const showToast = useToast();
  const [title, setTitle] = useState("");
  const [drafts, setDrafts] = useState<Record<LoadingCategory, Draft[]>>({ trays: [], glass: [], panels: [], extras: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!list) {
      setTitle("");
      setDrafts({ trays: [], glass: [], panels: [], extras: [] });
      return;
    }
    setTitle(list.title);
    loadingRepository.listItems(list.id).then((items) => {
      const grouped: Record<LoadingCategory, Draft[]> = { trays: [], glass: [], panels: [], extras: [] };
      for (const item of items) {
        const bucket = grouped[item.category as "trays" | "glass" | "panels" | "extras"];
        if (bucket) {
          bucket.push({
            key: item.id,
            name: item.name,
            note: item.note,
            quantity: item.quantity ?? "",
            doorInfo: item.doorInfo ?? "",
            checked: item.checked
          });
        }
      }
      setDrafts(grouped);
    });
  }, [open, list]);

  const addRow = (category: LoadingCategory) => {
    setDrafts((prev) => ({ ...prev, [category]: [...prev[category as "trays"], emptyDraft()] }));
  };
  const removeRow = (category: LoadingCategory, key: string) => {
    setDrafts((prev) => ({ ...prev, [category]: prev[category as "trays"].filter((d) => d.key !== key) }));
  };
  const patchRow = (category: LoadingCategory, key: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({
      ...prev,
      [category]: prev[category as "trays"].map((d) => (d.key === key ? { ...d, ...patch } : d))
    }));
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      showToast("სათაური აუცილებელია.", "warn");
      return;
    }
    setSaving(true);
    try {
      let listId = list?.id ?? null;
      if (!listId) {
        const created = await loadingRepository.createList({ title: trimmedTitle });
        listId = created.id;
      } else {
        await loadingRepository.renameList(listId, trimmedTitle);
        const existing = await loadingRepository.listItems(listId);
        await Promise.all(existing.map((it) => loadingRepository.deleteItem(it.id)));
      }
      for (const category of CATEGORIES) {
        for (const draft of drafts[category.key as "trays"]) {
          if (!draft.name.trim() && !draft.note.trim()) continue; // skip fully-empty rows
          await loadingRepository.addItem({
            loadingListId: listId,
            category: category.key,
            name: draft.name.trim(),
            note: draft.note.trim(),
            quantity: draft.quantity.trim() || null,
            doorInfo: draft.doorInfo.trim() || null,
            checked: draft.checked
          });
        }
      }
      showToast(list ? "სია განახლდა." : "სია დაემატა.", "ok");
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={list ? "დატვირთვის სიის რედაქტირება" : "ახალი დატვირთვის სია"}
      footer={
        <>
          <Button onClick={onClose}>გაუქმება</Button>
          <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
            შენახვა
          </Button>
        </>
      }
    >
      <label className="ui-form-field">
        <span className="ui-form-field__label">სათაური</span>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="მაგ. კლიენტის სახელი ან მისამართი" autoFocus />
      </label>

      {CATEGORIES.map((cat) => (
        <div key={cat.key} className="loading-dialog__category">
          <h3>{cat.label}</h3>
          {drafts[cat.key as "trays"].map((draft) => (
            <div key={draft.key} className="loading-dialog__row">
              <input
                type="checkbox"
                checked={draft.checked}
                onChange={(e) => patchRow(cat.key, draft.key, { checked: e.target.checked })}
              />
              {cat.hasName && (
                <Input
                  className="loading-dialog__name"
                  placeholder="დასახელება"
                  value={draft.name}
                  onChange={(e) => patchRow(cat.key, draft.key, { name: e.target.value })}
                />
              )}
              <Input
                className="loading-dialog__note"
                placeholder="შენიშვნა"
                value={draft.note}
                onChange={(e) => patchRow(cat.key, draft.key, { note: e.target.value })}
              />
              {cat.hasDoor && (
                <Input
                  className="loading-dialog__door"
                  placeholder="კარი"
                  value={draft.doorInfo}
                  onChange={(e) => patchRow(cat.key, draft.key, { doorInfo: e.target.value })}
                />
              )}
              {cat.hasName && (
                <Input
                  className="loading-dialog__qty"
                  placeholder="რაოდ."
                  value={draft.quantity}
                  onChange={(e) => patchRow(cat.key, draft.key, { quantity: e.target.value })}
                />
              )}
              <IconButton label="წაშლა" onClick={() => removeRow(cat.key, draft.key)}>
                ×
              </IconButton>
            </div>
          ))}
          <Button onClick={() => addRow(cat.key)}>+ დამატება</Button>
        </div>
      ))}
    </Dialog>
  );
}
