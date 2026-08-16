import { useCallback, useEffect, useState } from "react";
import { groupRepository, jobRepository } from "@/db/repositories";
import type { Group } from "@/entities/group";

export interface GroupWithJobCount extends Group {
  jobCount: number;
}

export function useGroups(opts: { includeArchived?: boolean } = {}) {
  const [groups, setGroups] = useState<GroupWithJobCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const list = await groupRepository.list({ includeArchived: opts.includeArchived });
      const withCounts = await Promise.all(
        list.map(async (g) => ({ ...g, jobCount: await jobRepository.countByGroup(g.id) }))
      );
      if (!cancelled) {
        setGroups(withCounts);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [opts.includeArchived, reloadToken]);

  return { groups, loading, reload };
}
