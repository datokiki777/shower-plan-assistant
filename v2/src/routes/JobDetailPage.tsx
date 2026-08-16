import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/shared/ui/PageHeader";
import { Card } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import { Select } from "@/shared/ui/fields";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { EmptyState } from "@/shared/ui/EmptyState";
import { useToast } from "@/shared/ui/Toast";
import { useConfirm } from "@/shared/ui/ConfirmDialog";
import { jobRepository, groupRepository } from "@/db/repositories";
import type { Job, JobStatus } from "@/entities/job";
import { JOB_STATUS_LABELS, JOB_STATUS_ORDER, JOB_STATUS_TONES } from "@/entities/job";
import type { Group } from "@/entities/group";
import { formatDateOnly } from "@/shared/lib/date";
import { JobForm } from "@/features/jobs/JobForm";
import "./JobDetailPage.css";

function DetailRow({ label, value }: { label: string; value?: string | string[] | null }) {
  if (!value || (Array.isArray(value) && value.length === 0)) return null;
  return (
    <div className="job-detail__row">
      <span className="job-detail__row-label">{label}</span>
      {Array.isArray(value) ? (
        <ul className="job-detail__row-list">
          {value.map((v, i) => (
            <li key={i}>{v}</li>
          ))}
        </ul>
      ) : (
        <p className="job-detail__row-value">{value}</p>
      )}
    </div>
  );
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const showToast = useToast();
  const confirm = useConfirm();
  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const [group, setGroup] = useState<Group | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    jobRepository.getById(id).then((found) => {
      setJob(found ?? null);
      if (found?.groupId) groupRepository.getById(found.groupId).then((g) => setGroup(g ?? null));
      else setGroup(null);
    });
  }, [id]);

  useEffect(load, [load]);

  if (job === undefined) return null;
  if (job === null) {
    return <EmptyState title="სამუშაო ვერ მოიძებნა" description="შესაძლოა წაშლილია." />;
  }

  const handleStatusChange = async (next: JobStatus) => {
    await jobRepository.setStatus(job.id, next);
    load();
    showToast("სტატუსი განახლდა.", "ok");
  };

  const handleArchive = async () => {
    const ok = await confirm({ title: "სამუშაოს დაარქივება", message: "სამუშაო გადავა არქივში. მონაცემები არ წაიშლება.", danger: false });
    if (!ok) return;
    await jobRepository.archive(job.id);
    load();
  };

  const handleRestore = async () => {
    await jobRepository.restore(job.id);
    load();
  };

  return (
    <div>
      <PageHeader
        eyebrow="Plans"
        title={job.clientSnapshot.fullName || "უსახელო კლიენტი"}
        actions={<Button onClick={() => setEditOpen(true)}>რედაქტირება</Button>}
      />

      <Card className="job-detail__status-card">
        <div className="job-detail__status-head">
          <StatusBadge label={JOB_STATUS_LABELS[job.status]} tone={JOB_STATUS_TONES[job.status]} />
          <Select value={job.status} onChange={(e) => void handleStatusChange(e.target.value as JobStatus)}>
            {JOB_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {JOB_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        <div className="job-detail__actions">
          {job.status === "archived" ? (
            <Button onClick={() => void handleRestore()}>აღდგენა</Button>
          ) : (
            <Button variant="danger" onClick={() => void handleArchive()}>
              დაარქივება
            </Button>
          )}
        </div>
      </Card>

      <Card className="job-detail__section">
        <h2 className="job-detail__section-title">კლიენტი</h2>
        <DetailRow label="სახელი" value={job.clientSnapshot.fullName} />
        <DetailRow label="მისამართი" value={job.clientSnapshot.address} />
        {job.clientSnapshot.phone && (
          <div className="job-detail__row">
            <span className="job-detail__row-label">ტელეფონი</span>
            <a className="job-detail__phone-link" href={`tel:${job.clientSnapshot.phone}`}>
              {job.clientSnapshot.phone}
            </a>
          </div>
        )}
        <button type="button" className="job-detail__link-button" onClick={() => navigate(`/clients/${job.clientId}`)}>
          კლიენტის გვერდზე გადასვლა
        </button>
      </Card>

      <Card className="job-detail__section">
        <h2 className="job-detail__section-title">სამუშაო</h2>
        <DetailRow label="ჯგუფი" value={group?.name} />
        <DetailRow label="თარიღი" value={job.jobDate ? formatDateOnly(job.jobDate) : null} />
        <DetailRow label="ხანგრძლივობა" value={job.jobDurationDays ? `${job.jobDurationDays} დღიანი` : null} />
      </Card>

      <Card className="job-detail__section">
        <h2 className="job-detail__section-title">პაკეტი და დუშთასე</h2>
        <DetailRow label="პაკეტი" value={job.packageType} />
        <DetailRow label="ანტირუჩი" value={job.antiSlip} />
        <DetailRow label="დუშთასეს ზომა" value={job.showerTraySize} />
      </Card>

      <Card className="job-detail__section">
        <h2 className="job-detail__section-title">მასალები</h2>
        <DetailRow label="შუშის ზომა" value={job.glassPartitionSize} />
        <DetailRow label="კარი" value={job.hingedDoorSize} />
        <DetailRow label="პანელის ფერი" value={job.panelColor} />
        <DetailRow label="იატაკის პანელის ფერი" value={job.floorPanelColor} />
        <DetailRow label="პანელი სადამდე კეთდება" value={job.panelHeight} />
        <DetailRow label="დასაყენებლების სია" value={job.installables} />
      </Card>

      <Card className="job-detail__section">
        <h2 className="job-detail__section-title">დამატებითი სამუშაოები და შენიშვნები</h2>
        <DetailRow label="დამატებითი სამუშაოები" value={job.extraWork} />
        <DetailRow label="სამუშაო შენიშვნები" value={job.workNotes} />
      </Card>

      <JobForm open={editOpen} onClose={() => setEditOpen(false)} job={job} onSaved={load} />
    </div>
  );
}
