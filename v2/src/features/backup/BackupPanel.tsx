import { useRef, useState } from "react";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { useConfirm } from "@/shared/ui/ConfirmDialog";
import { useToast } from "@/shared/ui/Toast";
import { buildBackup, parseBackup, restoreBackup } from "./backupService";
import type { V2Backup } from "./schema";
import "./BackupPanel.css";

export function BackupPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();
  const showToast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<V2Backup | null>(null);

  const handleExport = async () => {
    const backup = await buildBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `plans-v2-backup-${backup.exportedAt.slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    showToast("Backup ჩამოიტვირთა.", "ok");
  };

  const handleFile = async (file: File) => {
    setError(null);
    const text = await file.text();
    const parsed = parseBackup(text);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setPending(parsed.data);
  };

  const handleConfirmRestore = async () => {
    if (!pending) return;
    const ok = await confirm({
      title: "მონაცემების ჩანაცვლება",
      message: "ეს წაშლის ყველა ამჟამინდელ მონაცემს და ჩაანაცვლებს ბექაფის შიგთავსით. ეს ქმედება ვერ გაუქმდება. გავაგრძელოთ?"
    });
    if (!ok) return;
    try {
      await restoreBackup(pending);
      setPending(null);
      showToast("აღდგენა წარმატებით დასრულდა.", "ok");
    } catch (err) {
      console.error("Restore failed:", err);
      showToast("აღდგენა ვერ შესრულდა - მონაცემები არ შეცვლილა.", "warn");
    }
  };

  return (
    <Card className="backup-panel">
      <h2>Export V2 backup</h2>
      <p className="backup-panel__hint">ჩამოტვირთე ამჟამინდელი V2 მონაცემების JSON ასლი.</p>
      <Button onClick={() => void handleExport()}>Export backup</Button>

      <h2 className="backup-panel__restore-title">Restore V2 backup</h2>
      <p className="backup-panel__hint">
        <strong>ეს წაშლის და ჩაანაცვლებს ყველა ამჟამინდელ მონაცემს.</strong> ცალკე ფუნქციაა V1 იმპორტისგან.
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

      {error && <p className="backup-panel__error">{error}</p>}

      {pending && (
        <div className="backup-panel__preview">
          <p>
            ნაპოვნია: კლიენტები {pending.data.clients.length}, სამუშაოები {pending.data.jobs.length}, ჯგუფები {pending.data.groups.length},
            შაბლონები {pending.data.fieldTemplates.length}, დატვირთვის სიები {pending.data.loadingLists.length}, მუშები{" "}
            {pending.data.workers.length}
          </p>
          <Button variant="danger" onClick={() => void handleConfirmRestore()}>
            ჩანაცვლება
          </Button>
        </div>
      )}
    </Card>
  );
}
