import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/shared/ui/PageHeader";
import { Card } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { EmptyState } from "@/shared/ui/EmptyState";
import { useConfirm } from "@/shared/ui/ConfirmDialog";
import { clientRepository, jobRepository } from "@/db/repositories";
import type { Client } from "@/entities/client";
import type { Job } from "@/entities/job";
import { JOB_STATUS_LABELS, JOB_STATUS_TONES } from "@/entities/job";
import { formatDateOnly } from "@/shared/lib/date";
import { ClientForm } from "@/features/clients/ClientForm";
import { JobForm } from "@/features/jobs/JobForm";
import "./ClientDetailPage.css";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const confirm = useConfirm();
  const [client, setClient] = useState<Client | null | undefined>(undefined);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [jobFormOpen, setJobFormOpen] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    clientRepository.getById(id).then((found) => setClient(found ?? null));
    jobRepository.listByClient(id).then((list) => setJobs(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))));
  }, [id]);

  useEffect(load, [load]);

  if (client === undefined) return null;
  if (client === null) {
    return <EmptyState title="კლიენტი ვერ მოიძებნა" description="შესაძლოა წაშლილია ან დაარქივებულია." />;
  }

  const handleArchive = async () => {
    const ok = await confirm({ title: "კლიენტის დაარქივება", message: `„${client.fullName}“ დაარქივდება.`, danger: false });
    if (!ok) return;
    await clientRepository.archive(client.id);
    load();
  };

  const handleRestore = async () => {
    await clientRepository.restore(client.id);
    load();
  };

  return (
    <div>
      <PageHeader
        eyebrow="Plans"
        title={client.fullName || "უსახელო კლიენტი"}
        actions={<Button onClick={() => setEditOpen(true)}>რედაქტირება</Button>}
      />

      <Card className="client-detail__card">
        {client.archivedAt && <StatusBadge label="დაარქივებული" tone="danger" />}
        {client.address && <p className="client-detail__row">{client.address}</p>}
        {client.phone && (
          <a className="client-detail__phone" href={`tel:${client.phone}`}>
            {client.phone}
          </a>
        )}
        {client.googleMapsLink && (
          <a className="client-detail__maps" href={client.googleMapsLink} target="_blank" rel="noreferrer">
            📍 რუკაზე ნახვა
          </a>
        )}
        {client.notes && <p className="client-detail__notes">{client.notes}</p>}

        <div className="client-detail__actions">
          <Button variant="primary" onClick={() => setJobFormOpen(true)}>
            + ახალი სამუშაო
          </Button>
          {client.archivedAt ? (
            <Button onClick={() => void handleRestore()}>აღდგენა</Button>
          ) : (
            <Button variant="danger" onClick={() => void handleArchive()}>
              დაარქივება
            </Button>
          )}
        </div>
      </Card>

      <h2 className="client-detail__jobs-title">სამუშაოები ({jobs.length})</h2>
      {jobs.length === 0 && <EmptyState title="სამუშაო ჯერ არ არის" description="დაამატე პირველი სამუშაო ზემოთა ღილაკით." />}
      <div className="client-detail__jobs-list">
        {jobs.map((job) => (
          <Link key={job.id} to={`/jobs/${job.id}`} className="client-detail__job-row">
            <Card>
              <div className="client-detail__job-row-head">
                <span>{formatDateOnly(job.jobDate)}</span>
                <StatusBadge label={JOB_STATUS_LABELS[job.status]} tone={JOB_STATUS_TONES[job.status]} />
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <ClientForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        client={client}
        onSaved={(updated) => setClient(updated)}
      />
      <JobForm open={jobFormOpen} onClose={() => setJobFormOpen(false)} initialClientId={client.id} onSaved={load} />
    </div>
  );
}
