import { useCallback, useEffect, useState } from "react";
import { jobRepository } from "@/db/repositories";
import type { Job, JobStatus } from "@/entities/job";

export interface JobsFilter {
  status?: JobStatus;
  groupId?: string;
  query?: string;
}

export function useJobs(filter: JobsFilter) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const task = filter.query?.trim()
      ? jobRepository.search(filter.query)
      : jobRepository.list({ status: filter.status, groupId: filter.groupId, limit: 100 });
    task.then((result) => {
      if (!cancelled) {
        setJobs(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.status, filter.groupId, filter.query, reloadToken]);

  return { jobs, loading, reload };
}
