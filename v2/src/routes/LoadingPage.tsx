import { useState } from "react";
import { PageHeader } from "@/shared/ui/PageHeader";
import { SearchInput } from "@/shared/ui/SearchInput";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { useToast } from "@/shared/ui/Toast";
import { loadingRepository } from "@/db/repositories";
import { useLoadingLists } from "@/features/loading/useLoadingLists";
import { LoadingListDialog } from "@/features/loading/LoadingListDialog";
import type { LoadingList } from "@/entities/loading-list";
import "./LoadingPage.css";

export default function LoadingPage() {
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const { lists, reload } = useLoadingLists(query, { includeArchived });
  const [editTarget, setEditTarget] = useState<LoadingList | null | undefined>(undefined);
  const showToast = useToast();

  const handleDuplicate = async (list: LoadingList) => {
    await loadingRepository.duplicateList(list.id);
    reload();
    showToast("სია დუბლირებულია.", "ok");
  };

  const handleArchive = async (list: LoadingList) => {
    await loadingRepository.archiveList(list.id);
    reload();
  };

  const handleRestore = async (list: LoadingList) => {
    await loadingRepository.restoreList(list.id);
    reload();
  };

  return (
    <div>
      <PageHeader
        eyebrow="Plans"
        title="დატვირთვა"
        actions={
          <Button variant="primary" onClick={() => setEditTarget(null)}>
            + სია
          </Button>
        }
      />

      <div className="loading-page__controls">
        <SearchInput placeholder="მოძებნე სათაურით…" onSearch={setQuery} />
        <label className="loading-page__archived-toggle">
          <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
          დაარქივებულების ჩვენება
        </label>
      </div>

      {lists.length === 0 && <EmptyState title="სია არ მოიძებნა" description="დაამატე პირველი დატვირთვის სია ზემოთა ღილაკით." />}

      <div className="loading-page__list">
        {lists.map((list) => (
          <Card key={list.id} className="loading-page__row">
            <div className="loading-page__row-head">
              <strong>{list.title}</strong>
              {list.archivedAt && <StatusBadge label="დაარქივებული" tone="danger" />}
            </div>
            <div className="loading-page__row-actions">
              <Button onClick={() => setEditTarget(list)}>რედაქტირება</Button>
              <Button onClick={() => void handleDuplicate(list)}>დუბლირება</Button>
              {list.archivedAt ? (
                <Button onClick={() => void handleRestore(list)}>აღდგენა</Button>
              ) : (
                <Button variant="danger" onClick={() => void handleArchive(list)}>
                  დაარქივება
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <LoadingListDialog open={editTarget !== undefined} onClose={() => setEditTarget(undefined)} list={editTarget} onSaved={reload} />
    </div>
  );
}
