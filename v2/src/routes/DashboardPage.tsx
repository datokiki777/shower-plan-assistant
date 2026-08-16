import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/shared/ui/PageHeader";
import { Card } from "@/shared/ui/Card";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { EmptyState } from "@/shared/ui/EmptyState";
import { jobRepository, workerRepository, stayRepository, loadingRepository } from "@/db/repositories";
import type { Job } from "@/entities/job";
import { JOB_STATUS_LABELS, JOB_STATUS_TONES } from "@/entities/job";
import { currentPeriodInfo } from "@/entities/stay";
import type { LoadingList } from "@/entities/loading-list";
import { formatDateOnly, todayDateOnly } from "@/shared/lib/date";
import "./DashboardPage.css";

interface DashboardData {
  activeCount: number;
  upcoming: Job[];
  recent: Job[];
  workersInside: number;
  workersUrgent: number;
  recentLoadingLists: LoadingList[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Every query below is bounded (indexed .where() + .count(), or a
      // small .limit()) - never a full-table toArray() over every Job.
      const [activeCount, activeJobs, plannedJobs, recent, workers, recentLoadingLists] = await Promise.all([
        jobRepository.list({ status: "active" }).then((r) => r.length),
        jobRepository.list({ status: "active", limit: 50 }),
        jobRepository.list({ status: "planned", limit: 50 }),
        jobRepository.list({ limit: 5 }),
        workerRepository.list(),
        loadingRepository.listLists({ includeArchived: false })
      ]);

      const today = todayDateOnly();
      const upcoming = [...activeJobs, ...plannedJobs]
        .filter((j) => j.jobDate && j.jobDate >= today)
        .sort((a, b) => (a.jobDate as string).localeCompare(b.jobDate as string))
        .slice(0, 5);

      const workerInfos = await Promise.all(
        workers.map(async (w) => currentPeriodInfo(await stayRepository.listByWorker(w.id)))
      );
      const workersInside = workerInfos.filter((i) => i.inside).length;
      const workersUrgent = workerInfos.filter((i) => i.inside && (i.remainingDays ?? 99) <= 14).length;

      if (!cancelled) {
        setData({
          activeCount,
          upcoming,
          recent,
          workersInside,
          workersUrgent,
          recentLoadingLists: recentLoadingLists.slice(0, 3)
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return null;

  return (
    <div>
      <PageHeader eyebrow="Plans" title="მთავარი" />

      <div className="dashboard__stats">
        <Card className="dashboard__stat">
          <span>აქტიური სამუშაო</span>
          <strong>{data.activeCount}</strong>
        </Card>
        <Card className="dashboard__stat">
          <span>ქვეყანაში (მუშები)</span>
          <strong>{data.workersInside}</strong>
        </Card>
        <Card className="dashboard__stat dashboard__stat--warn">
          <span>გასვლა ≤ 14 დღე</span>
          <strong>{data.workersUrgent}</strong>
        </Card>
      </div>

      <section className="dashboard__section">
        <h2>მოახლოებული სამუშაოები</h2>
        {data.upcoming.length === 0 ? (
          <EmptyState title="მოახლოებული სამუშაო არ არის" />
        ) : (
          <div className="dashboard__list">
            {data.upcoming.map((job) => (
              <Link key={job.id} to={`/jobs/${job.id}`} className="dashboard__row">
                <Card>
                  <div className="dashboard__row-head">
                    <strong>{job.clientSnapshot.fullName}</strong>
                    <StatusBadge label={JOB_STATUS_LABELS[job.status]} tone={JOB_STATUS_TONES[job.status]} />
                  </div>
                  <span className="dashboard__row-meta">{formatDateOnly(job.jobDate)}</span>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard__section">
        <h2>ბოლოს ცვლილი სამუშაოები</h2>
        <div className="dashboard__list">
          {data.recent.map((job) => (
            <Link key={job.id} to={`/jobs/${job.id}`} className="dashboard__row">
              <Card>
                <div className="dashboard__row-head">
                  <strong>{job.clientSnapshot.fullName}</strong>
                  <StatusBadge label={JOB_STATUS_LABELS[job.status]} tone={JOB_STATUS_TONES[job.status]} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="dashboard__section">
        <h2>დატვირთვის სიები</h2>
        {data.recentLoadingLists.length === 0 ? (
          <EmptyState title="სია არ არის" />
        ) : (
          <div className="dashboard__list">
            {data.recentLoadingLists.map((list) => (
              <Link key={list.id} to="/loading" className="dashboard__row">
                <Card>{list.title}</Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
