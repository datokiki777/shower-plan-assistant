import { useState } from "react";
import { PageHeader } from "@/shared/ui/PageHeader";
import { Card } from "@/shared/ui/Card";
import { Input } from "@/shared/ui/fields";
import { Button } from "@/shared/ui/Button";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { EmptyState } from "@/shared/ui/EmptyState";
import { useToast } from "@/shared/ui/Toast";
import { useConfirm } from "@/shared/ui/ConfirmDialog";
import { groupRepository } from "@/db/repositories";
import { canPermanentlyDeleteGroup } from "@/entities/group";
import { useGroups } from "@/features/groups/useGroups";
import "./GroupsPage.css";

export default function GroupsPage() {
  const [includeArchived, setIncludeArchived] = useState(false);
  const { groups, reload } = useGroups({ includeArchived });
  const [newName, setNewName] = useState("");
  const showToast = useToast();
  const confirm = useConfirm();

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    await groupRepository.create({ name });
    setNewName("");
    reload();
  };

  const handleRename = async (id: string, currentName: string) => {
    const next = window.prompt("ჯგუფის ახალი დასახელება:", currentName);
    if (next == null) return;
    const trimmed = next.trim();
    if (!trimmed) return;
    await groupRepository.rename(id, trimmed);
    reload();
  };

  const handleArchive = async (id: string, name: string) => {
    const ok = await confirm({
      title: "ჯგუფის დაარქივება",
      message: `„${name}“ დაარქივდება. მასთან დაკავშირებული სამუშაოები უცვლელი დარჩება - მხოლოდ ჯგუფი მოიხსნება აქტიური სიიდან.`,
      danger: false
    });
    if (!ok) return;
    await groupRepository.archive(id);
    reload();
  };

  const handleRestore = async (id: string) => {
    await groupRepository.restore(id);
    reload();
  };

  const handleDelete = async (id: string, name: string, jobCount: number) => {
    if (!canPermanentlyDeleteGroup(jobCount)) {
      showToast(`„${name}“ ვერ წაიშლება სამუდამოდ - მასზეა მიბმული ${jobCount} სამუშაო. ჯერ დაარქივე.`, "warn");
      return;
    }
    const ok = await confirm({ title: "სამუდამო წაშლა", message: `„${name}“ სამუდამოდ წაიშლება. გავაგრძელოთ?` });
    if (!ok) return;
    await groupRepository.delete(id);
    reload();
  };

  return (
    <div>
      <PageHeader eyebrow="Plans" title="ჯგუფები" />

      <div className="groups-page__add-row">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleCreate();
            }
          }}
          placeholder="ახალი ჯგუფის დასახელება"
        />
        <Button variant="primary" onClick={() => void handleCreate()}>
          + ჯგუფი
        </Button>
      </div>

      <label className="groups-page__archived-toggle">
        <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
        დაარქივებულების ჩვენება
      </label>

      {groups.length === 0 && <EmptyState title="ჯგუფი ჯერ არ არის" description="შექმენი პირველი ჯგუფი ზემოთ." />}

      <div className="groups-page__list">
        {groups.map((g) => (
          <Card key={g.id} className="groups-page__row">
            <div className="groups-page__row-head">
              <strong>{g.name}</strong>
              <span className="groups-page__count">{g.jobCount} სამუშაო</span>
              {g.archivedAt && <StatusBadge label="დაარქივებული" tone="danger" />}
            </div>
            <div className="groups-page__actions">
              {g.archivedAt ? (
                <Button onClick={() => void handleRestore(g.id)}>აღდგენა</Button>
              ) : (
                <>
                  <Button onClick={() => void handleRename(g.id, g.name)}>გადარქმევა</Button>
                  <Button onClick={() => void handleArchive(g.id, g.name)}>დაარქივება</Button>
                </>
              )}
              <Button variant="danger" onClick={() => void handleDelete(g.id, g.name, g.jobCount)}>
                სამუდამო წაშლა
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
