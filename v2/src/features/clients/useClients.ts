import { useCallback, useEffect, useState } from "react";
import { clientRepository } from "@/db/repositories";
import type { Client } from "@/entities/client";

export function useClients(query: string, opts: { includeArchived?: boolean } = {}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const task = query.trim()
      ? clientRepository.search(query)
      : clientRepository.list({ includeArchived: opts.includeArchived });
    task.then((result) => {
      if (!cancelled) {
        setClients(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, opts.includeArchived, reloadToken]);

  return { clients, loading, reload };
}
