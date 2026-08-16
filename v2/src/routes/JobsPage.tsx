import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/shared/ui/PageHeader";
import { SearchInput } from "@/shared/ui/SearchInput";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { useJobs } from "@/features/jobs/useJobs";
import { JobForm } from "@/features/jobs/JobForm";
import { groupRepository } from "@/db/repositories";
import type { Group } from "@/entities/group";
import { JOB_STATUS_LABELS, JOB_STATUS_TONES, type JobStatus } from "@/entities/job";
import { formatDateOnly } from "@/shared/lib/date";
import "./JobsPage.css";

const STATUS_TABS: Array<{ label: string; value: JobStatus | "" }> = [
  { label: "ყველა აქტიური", value: "" },
  { label: JOB_STATUS_LABELS.planned, value: "planned" },
  { label: JOB_STATUS_LABELS.active, value: "active" },
  { label: JOB_STATUS_LABELS.completed, value: "completed" },
  { label: JOB_STATUS_LABELS.archived, value: "archived" }
];

export default function JobsPage() {
  const [status, setStatus] = useState<JobStatus | "">("");
  const [groupId, setGroupId] = useState("");
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const { jobs, reload } = useJobs({ status: status || undefined, groupId: groupId || undefined, query });

  useEffect(() => {
    groupRepository.list().then(setGroups);
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Plans"
        title="სამუშაოები"
        actions={
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            + სამუშაო
          </Button>
        }
      />

      <SearchInput placeholder="მოძებნე კლიენტის სახელით/მისამართით…" onSearch={setQuery} />

      {!query && (
        <div className="jobs-page__tabs">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`jobs-page__tab${status === tab.value ? " jobs-page__tab--active" : ""}`}
              onClick={() => setStatus(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div className="jobs-page__group-filter">
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="ui-field">
          <option value="">ყველა ჯგუფი</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      {jobs.length === 0 && <EmptyState title="სამუშაო არ მოიძებნა" description="დაამატე პირველი სამუშაო ზემოთა ღილაკით." />}

      <div className="jobs-page__list">
        {jobs.map((job) => (
          <Link key={job.id} to={`/jobs/${job.id}`} className="jobs-page__row">
            <Card>
              <div className="jobs-page__row-head">
                <strong>{job.clientSnapshot.fullName || "უსახელო კლიენტი"}</strong>
                <StatusBadge label={JOB_STATUS_LABELS[job.status]} tone={JOB_STATUS_TONES[job.status]} />
              </div>
              <p className="jobs-page__row-meta">
                {formatDateOnly(job.jobDate)}
                {job.jobDurationDays ? ` · ${job.jobDurationDays} დღიანი` : ""}
              </p>
            </Card>
          </Link>
        ))}
      </div>

      <JobForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={reload} />
    </div>
  );
}
