import { useCallback, useEffect, useState } from "react";
import { workerRepository, stayRepository } from "@/db/repositories";
import { currentPeriodInfo, type WorkerPeriodInfo } from "@/entities/stay";
import type { Worker } from "@/entities/worker";
import type { Stay } from "@/entities/stay";

export interface WorkerWithInfo extends Worker {
  stays: Stay[];
  info: WorkerPeriodInfo;
}

export function useWorkers(query: string) {
  const [workers, setWorkers] = useState<WorkerWithInfo[]>([]);
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await workerRepository.list();
      const withStays = await Promise.all(
        list.map(async (w) => {
          const stays = await stayRepository.listByWorker(w.id);
          return { ...w, stays, info: currentPeriodInfo(stays) };
        })
      );
      const q = query.trim().toLocaleLowerCase("ka");
      const filtered = q ? withStays.filter((w) => w.name.toLocaleLowerCase("ka").includes(q)) : withStays;
      // Inside workers first (matches V1), then alphabetical.
      filtered.sort((a, b) => Number(b.info.inside) - Number(a.info.inside) || a.name.localeCompare(b.name, "ka"));
      if (!cancelled) setWorkers(filtered);
    })();
    return () => {
      cancelled = true;
    };
  }, [query, reloadToken]);

  return { workers, reload };
}
