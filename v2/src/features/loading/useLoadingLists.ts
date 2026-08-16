import { useCallback, useEffect, useState } from "react";
import { loadingRepository } from "@/db/repositories";
import type { LoadingList } from "@/entities/loading-list";

export function useLoadingLists(query: string, opts: { includeArchived?: boolean } = {}) {
  const [lists, setLists] = useState<LoadingList[]>([]);
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    const task = query.trim() ? loadingRepository.searchLists(query) : loadingRepository.listLists(opts);
    task.then((result) => {
      if (!cancelled) setLists(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, opts.includeArchived, reloadToken]);

  return { lists, reload };
}
