import { useRef, useState } from "react";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { useConfirm } from "@/shared/ui/ConfirmDialog";
import { useToast } from "@/shared/ui/Toast";
import { parseLegacyExport, findExistingImport, buildPreview, runLegacyImport } from "./importLegacyData";
import type { LegacyExport } from "./schema";
import type { TransformResult } from "./transform";
import type { MigrationRecord } from "@/entities/migration-record";
import "./LegacyImportPanel.css";

const COUNT_LABELS: Record<keyof TransformResult["counts"], string> = {
  jobs: "სამუშაოები",
  clients: "კლიენტები",
  groups: "ჯგუფები",
  fieldTemplates: "შაბლონები",
  loadingLists: "დატვირთვის სიები",
  workers: "მუშები",
  loadingItems: "დატვირთვის ჩანაწერები",
  stays: "პერიოდები"
};

export function LegacyImportPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();
  const showToast = useToast();

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ legacyExport: LegacyExport; preview: TransformResult } | null>(null);
  const [summary, setSummary] = useState<MigrationRecord | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFile = async (file: File) => {
    setError(null);
    setSummary(null);
    setPending(null);
    const text = await file.text();
    const parsed = parseLegacyExport(text);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    const existing = await findExistingImport(parsed.data.exportId);
    if (existing) {
      const proceed = await confirm({
        title: "ეს ფაილი უკვე იმპორტირებულია",
        message: `ეს ბექაფი (${new Date(parsed.data.exportedAt).toLocaleDateString("ka-GE")}) უკვე იმპორტირებული იყო ${new Date(existing.importedAt).toLocaleDateString("ka-GE")}. თავიდან იმპორტი გააორმაგებს ჩანაწერებს. გავაგრძელოთ?`
      });
      if (!proceed) return;
    }

    const preview = buildPreview(parsed.data);
    setPending({ legacyExport: parsed.data, preview });
  };

  const handleConfirmImport = async () => {
    if (!pending) return;
    setImporting(true);
    try {
      const record = await runLegacyImport(pending.legacyExport, pending.preview);
      setSummary(record);
      setPending(null);
      showToast("იმპორტი წარმატებით დასრულდა.", "ok");
    } catch (err) {
      console.error("Legacy import failed:", err);
      showToast("იმპორტი ვერ შესრულდა. მონაცემები არ შეცვლილა (ტრანზაქცია გაუქმდა).", "warn");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card className="legacy-import">
      <h2>Import from Shower Plan Assistant V1</h2>
      <p className="legacy-import__hint">
        აირჩიე V1 აპიდან ჩამოტვირთული „Export data for V2“ JSON ფაილი. ეს მხოლოდ კითხულობს ფაილს - არაფერს არ წერს, სანამ არ დაადასტურებ.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
      <Button onClick={() => fileInputRef.current?.click()}>ფაილის არჩევა</Button>

      {error && <p className="legacy-import__error">{error}</p>}

      {pending && (
        <div className="legacy-import__preview">
          <p className="legacy-import__preview-title">
            V1 Backup detected · Exported: {new Date(pending.legacyExport.exportedAt).toLocaleDateString("ka-GE")}
          </p>
          <ul>
            {(Object.keys(COUNT_LABELS) as Array<keyof TransformResult["counts"]>).map((key) => (
              <li key={key}>
                {COUNT_LABELS[key]}: {pending.preview.counts[key]}
              </li>
            ))}
          </ul>
          {pending.preview.warnings.length > 0 && (
            <div className="legacy-import__warnings">
              <strong>გაფრთხილებები ({pending.preview.warnings.length}):</strong>
              <ul>
                {pending.preview.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          <Button variant="primary" onClick={() => void handleConfirmImport()} disabled={importing}>
            იმპორტი
          </Button>
        </div>
      )}

      {summary && (
        <div className="legacy-import__summary">
          <strong>Migration completed successfully</strong>
          <ul>
            {(Object.keys(COUNT_LABELS) as Array<keyof TransformResult["counts"]>).map((key) => (
              <li key={key}>
                {COUNT_LABELS[key]}: {summary.recordCounts[key] ?? 0}
              </li>
            ))}
          </ul>
          <p>გაფრთხილებები: {summary.warnings.length}</p>
        </div>
      )}
    </Card>
  );
}
