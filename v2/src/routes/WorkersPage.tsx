import { useMemo, useState } from "react";
import { PageHeader } from "@/shared/ui/PageHeader";
import { Card } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import { Dialog } from "@/shared/ui/Dialog";
import { Input } from "@/shared/ui/fields";
import { SearchInput } from "@/shared/ui/SearchInput";
import { EmptyState } from "@/shared/ui/EmptyState";
import { useToast } from "@/shared/ui/Toast";
import { useConfirm } from "@/shared/ui/ConfirmDialog";
import { workerRepository, stayRepository } from "@/db/repositories";
import { useWorkers, type WorkerWithInfo } from "@/features/periods/useWorkers";
import { maxDeparture } from "@/entities/stay";
import { formatDateOnly, todayDateOnly } from "@/shared/lib/date";
import "./WorkersPage.css";

export default function WorkersPage() {
  const [query, setQuery] = useState("");
  const { workers, reload } = useWorkers(query);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEntry, setNewEntry] = useState(todayDateOnly());
  const [exitTarget, setExitTarget] = useState<WorkerWithInfo | null>(null);
  const [exitDate, setExitDate] = useState("");
  const [historyTarget, setHistoryTarget] = useState<WorkerWithInfo | null>(null);
  const showToast = useToast();
  const confirm = useConfirm();

  const stats = useMemo(() => {
    const inside = workers.filter((w) => w.info.inside).length;
    const urgent = workers.filter((w) => w.info.inside && (w.info.remainingDays ?? 99) <= 14).length;
    return { total: workers.length, inside, urgent };
  }, [workers]);

  const handleAddWorker = async () => {
    const name = newName.trim();
    if (!name || !newEntry) return;
    const worker = await workerRepository.create({ name });
    await stayRepository.create({ workerId: worker.id, entryDate: newEntry });
    setNewName("");
    setNewEntry(todayDateOnly());
    setAddOpen(false);
    reload();
    showToast("პიროვნება დაემატა.", "ok");
  };

  const openExitDialog = (worker: WorkerWithInfo) => {
    setExitTarget(worker);
    setExitDate(todayDateOnly());
  };

  const handleRecordExit = async () => {
    if (!exitTarget?.info.active) return;
    const stay = exitTarget.info.active;
    const max = maxDeparture(exitTarget.stays, stay);
    if (exitDate < stay.entryDate || exitDate > max) {
      showToast(`გასვლა უნდა იყოს ${formatDateOnly(stay.entryDate)}–${formatDateOnly(max)}`, "warn");
      return;
    }
    await stayRepository.recordExit(stay.id, exitDate);
    setExitTarget(null);
    reload();
    showToast("გასვლა დაფიქსირდა.", "ok");
  };

  const handleNewEntryForWorker = async (worker: WorkerWithInfo) => {
    await stayRepository.create({ workerId: worker.id, entryDate: todayDateOnly() });
    reload();
  };

  const handleDelete = async (worker: WorkerWithInfo) => {
    const ok = await confirm({ title: "პიროვნების წაშლა", message: `წაიშალოს ${worker.name} და მისი სრული ისტორია?` });
    if (!ok) return;
    await workerRepository.delete(worker.id);
    reload();
  };

  return (
    <div>
      <PageHeader
        eyebrow="Plans"
        title="პერიოდები"
        actions={
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            + პიროვნება
          </Button>
        }
      />

      <div className="workers-page__stats">
        <Card className="workers-page__stat">
          <span>სულ პიროვნება</span>
          <strong>{stats.total}</strong>
        </Card>
        <Card className="workers-page__stat">
          <span>ახლა ქვეყანაში</span>
          <strong>{stats.inside}</strong>
        </Card>
        <Card className="workers-page__stat workers-page__stat--warn">
          <span>გასვლა ≤ 14 დღე</span>
          <strong>{stats.urgent}</strong>
        </Card>
      </div>

      <SearchInput placeholder="მოძებნე სახელით…" onSearch={setQuery} />

      {workers.length === 0 && <EmptyState title="პიროვნება ჯერ არ არის" description="დაამატე პირველი პიროვნება ზემოთა ღილაკით." />}

      <div className="workers-page__list">
        {workers.map((w) => (
          <Card key={w.id} className="workers-page__row">
            <div className="workers-page__row-head">
              <strong>{w.name}</strong>
              <span className={`workers-page__status${w.info.inside ? "" : " workers-page__status--out"}`}>
                {w.info.inside ? "● ქვეყანაშია" : "○ გასულია"}
              </span>
            </div>
            <div className="workers-page__row-meta">
              {w.info.inside ? (
                <>
                  <span>შემოვიდა: {formatDateOnly(w.info.active?.entryDate ?? null)}</span>
                  <span>მაქს. გასვლა: {formatDateOnly(w.info.maxDepartureDate)}</span>
                </>
              ) : w.info.last ? (
                <>
                  <span>ბოლო შემოსვლა: {formatDateOnly(w.info.last.entryDate)}</span>
                  <span>გავიდა: {formatDateOnly(w.info.last.exitDate)}</span>
                </>
              ) : null}
              <span>დაბრუნება: {formatDateOnly(w.info.backDate)}</span>
            </div>
            <div className="workers-page__row-actions">
              {w.info.inside ? (
                <Button variant="primary" onClick={() => openExitDialog(w)}>
                  გასვლა
                </Button>
              ) : (
                <Button variant="primary" onClick={() => void handleNewEntryForWorker(w)}>
                  შესვლა
                </Button>
              )}
              <Button onClick={() => setHistoryTarget(w)}>ისტორია · {w.stays.length}</Button>
              <Button variant="danger" onClick={() => void handleDelete(w)}>
                წაშლა
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="პიროვნების დამატება"
        footer={
          <>
            <Button onClick={() => setAddOpen(false)}>გაუქმება</Button>
            <Button variant="primary" onClick={() => void handleAddWorker()}>
              შენახვა
            </Button>
          </>
        }
      >
        <label className="ui-form-field">
          <span className="ui-form-field__label">სახელი და გვარი</span>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
        </label>
        <label className="ui-form-field">
          <span className="ui-form-field__label">ჩამოსვლის თარიღი</span>
          <Input type="date" value={newEntry} onChange={(e) => setNewEntry(e.target.value)} />
        </label>
      </Dialog>

      <Dialog
        open={exitTarget !== null}
        onClose={() => setExitTarget(null)}
        title={`გასვლის დაფიქსირება - ${exitTarget?.name ?? ""}`}
        footer={
          <>
            <Button onClick={() => setExitTarget(null)}>გაუქმება</Button>
            <Button variant="primary" onClick={() => void handleRecordExit()}>
              დადასტურება
            </Button>
          </>
        }
      >
        <label className="ui-form-field">
          <span className="ui-form-field__label">გასვლის თარიღი</span>
          <Input type="date" value={exitDate} onChange={(e) => setExitDate(e.target.value)} />
        </label>
      </Dialog>

      <Dialog open={historyTarget !== null} onClose={() => setHistoryTarget(null)} title={`ისტორია - ${historyTarget?.name ?? ""}`}>
        <div className="workers-page__history">
          {[...(historyTarget?.stays ?? [])]
            .sort((a, b) => b.entryDate.localeCompare(a.entryDate))
            .map((s) => (
              <div key={s.id} className="workers-page__history-row">
                <span>შემოსვლა: {formatDateOnly(s.entryDate)}</span>
                <span>გასვლა: {s.exitDate ? formatDateOnly(s.exitDate) : "ჯერ ქვეყანაშია"}</span>
              </div>
            ))}
        </div>
      </Dialog>
    </div>
  );
}
