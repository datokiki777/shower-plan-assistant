import { useEffect, useState } from "react";
import { useForm, Controller, type UseFormRegister, type UseFormSetValue, type UseFormWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog } from "@/shared/ui/Dialog";
import { Button } from "@/shared/ui/Button";
import { FormField, Input, Select, Textarea } from "@/shared/ui/fields";
import { useToast } from "@/shared/ui/Toast";
import { clientRepository, groupRepository, jobRepository } from "@/db/repositories";
import type { Client } from "@/entities/client";
import type { Group } from "@/entities/group";
import type { Job } from "@/entities/job";
import { jobFormSchema, JOB_FORM_DEFAULTS, jobFormToPersistedFields, jobToFormValues, type JobFormValues } from "@/entities/job";
import { TEMPLATE_FIELD_KEYS, TEMPLATE_FIELD_LABELS, type FieldTemplate, type TemplateFieldKey } from "@/entities/template";
import { useAllFieldTemplates } from "@/features/templates/useFieldTemplates";
import { TemplateFieldButton } from "@/features/templates/TemplateFieldButton";
import { ClientForm } from "@/features/clients/ClientForm";
import "./JobForm.css";

export interface JobFormProps {
  open: boolean;
  onClose: () => void;
  job?: Job | null;
  /** Pre-select a client, e.g. when starting a Job from a Client's detail page. */
  initialClientId?: string;
  onSaved: (job: Job) => void;
}

const DURATION_OPTIONS = ["1", "2", "3", "4", "5", "6", "7"];

/** The single-value templated fields share both a JobFormValues key name and
 * a TemplateFieldKey name - kept literally identical on purpose so this
 * union works for both without any unsafe casts. */
type SingleTemplateFieldName = Exclude<TemplateFieldKey, "glassPartitionSize" | "installables">;

const SINGLE_TEMPLATE_FIELDS: SingleTemplateFieldName[] = [
  "packageType",
  "antiSlip",
  "showerTraySize",
  "hingedDoorSize",
  "panelColor",
  "floorPanelColor",
  "panelHeight"
];

export function JobForm({ open, onClose, job, initialClientId, onSaved }: JobFormProps) {
  const showToast = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const { byField: templatesByField } = useAllFieldTemplates(TEMPLATE_FIELD_KEYS);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: JOB_FORM_DEFAULTS
  });

  useEffect(() => {
    if (!open) return;
    Promise.all([clientRepository.list(), groupRepository.list()]).then(([c, g]) => {
      setClients(c);
      setGroups(g);
    });
    reset(job ? jobToFormValues(job) : { ...JOB_FORM_DEFAULTS, clientId: initialClientId ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, job, initialClientId]);

  const onSubmit = handleSubmit(async (values) => {
    const fields = jobFormToPersistedFields(values);
    const client = clients.find((c) => c.id === values.clientId);
    if (!client) {
      showToast("კლიენტი ვერ მოიძებნა.", "warn");
      return;
    }

    if (job) {
      // Snapshot is only refreshed if the assigned client actually changed on
      // this save - editing other fields (or the Client's own record
      // elsewhere) must never silently rewrite historical data. See
      // DATA_MODEL.md §2 and MIGRATION_PLAN.md.
      const clientChanged = job.clientId !== values.clientId;
      const patch = {
        ...fields,
        ...(clientChanged
          ? { clientSnapshot: { fullName: client.fullName, address: client.address, phone: client.phone } }
          : {})
      };
      await jobRepository.update(job.id, patch);
      onSaved({ ...job, ...patch });
      showToast("სამუშაო განახლდა.", "ok");
    } else {
      const created = await jobRepository.create({
        ...fields,
        status: "planned",
        clientSnapshot: { fullName: client.fullName, address: client.address, phone: client.phone }
      });
      onSaved(created);
      showToast("სამუშაო დაემატა.", "ok");
    }
    onClose();
  });

  const glassText = watch("glassPartitionSizeText");
  const installablesText = watch("installablesText");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={job ? "სამუშაოს რედაქტირება" : "ახალი სამუშაო"}
      footer={
        <>
          <Button onClick={onClose}>გაუქმება</Button>
          <Button variant="primary" onClick={() => void onSubmit()} disabled={isSubmitting}>
            შენახვა
          </Button>
        </>
      }
    >
      <form onSubmit={(e) => void onSubmit(e)} className="job-form">
        <FormField label="კლიენტი" error={errors.clientId?.message}>
          <div className="job-form__client-row">
            <Select {...register("clientId")}>
              <option value="">— აირჩიე კლიენტი —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </Select>
            <Button type="button" onClick={() => setQuickClientOpen(true)}>
              + ახალი
            </Button>
          </div>
        </FormField>

        <FormField label="ჯგუფი" error={errors.groupId?.message}>
          <Select {...register("groupId")}>
            <option value="">— აირჩიე ჯგუფი —</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </FormField>

        <div className="job-form__two-col">
          <FormField label="სამუშაოს თარიღი" error={errors.jobDate?.message}>
            <Input type="date" {...register("jobDate")} />
          </FormField>
          <FormField label="ხანგრძლივობა">
            <Select {...register("jobDurationDays")}>
              <option value="">—</option>
              {DURATION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} დღიანი
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <h3 className="job-form__section-title">პაკეტი და დუშთასე</h3>
        <div className="job-form__two-col">
          {SINGLE_TEMPLATE_FIELDS.slice(0, 2).map((name) => (
            <TemplatedField
              key={name}
              name={name}
              register={register}
              templates={templatesByField[name] ?? []}
              watch={watch}
              setValue={setValue}
            />
          ))}
        </div>
        <TemplatedField
          name="showerTraySize"
          register={register}
          templates={templatesByField.showerTraySize ?? []}
          watch={watch}
          setValue={setValue}
        />

        <h3 className="job-form__section-title">მასალები</h3>
        <div className="job-form__field-with-button">
          <FormField label={TEMPLATE_FIELD_LABELS.glassPartitionSize}>
            <Controller name="glassPartitionSizeText" control={control} render={({ field }) => <Textarea rows={2} {...field} />} />
          </FormField>
          <TemplateFieldButton
            fieldKey="glassPartitionSize"
            templates={templatesByField.glassPartitionSize ?? []}
            value={glassText}
            onChange={(v) => setValue("glassPartitionSizeText", v, { shouldDirty: true })}
          />
        </div>

        {SINGLE_TEMPLATE_FIELDS.slice(3).map((name) => (
          <TemplatedField
            key={name}
            name={name}
            register={register}
            templates={templatesByField[name] ?? []}
            watch={watch}
            setValue={setValue}
          />
        ))}

        <div className="job-form__field-with-button">
          <FormField label={TEMPLATE_FIELD_LABELS.installables}>
            <Controller name="installablesText" control={control} render={({ field }) => <Textarea rows={4} {...field} />} />
          </FormField>
          <TemplateFieldButton
            fieldKey="installables"
            templates={templatesByField.installables ?? []}
            value={installablesText}
            onChange={(v) => setValue("installablesText", v, { shouldDirty: true })}
          />
        </div>

        <h3 className="job-form__section-title">დამატებითი სამუშაოები და შენიშვნები</h3>
        <FormField label="დამატებითი სამუშაოები">
          <Textarea rows={3} {...register("extraWorkText")} />
        </FormField>
        <FormField label="სამუშაო შენიშვნები">
          <Textarea rows={3} {...register("workNotesText")} />
        </FormField>
      </form>

      <ClientForm
        open={quickClientOpen}
        onClose={() => setQuickClientOpen(false)}
        onSaved={(newClient) => {
          setClients((prev) => [...prev, newClient].sort((a, b) => a.fullName.localeCompare(b.fullName, "ka")));
          setValue("clientId", newClient.id, { shouldDirty: true, shouldValidate: true });
        }}
      />
    </Dialog>
  );
}

interface TemplatedFieldProps {
  name: SingleTemplateFieldName;
  register: UseFormRegister<JobFormValues>;
  templates: FieldTemplate[];
  watch: UseFormWatch<JobFormValues>;
  setValue: UseFormSetValue<JobFormValues>;
}

function TemplatedField({ name, register, templates, watch, setValue }: TemplatedFieldProps) {
  const value = watch(name);
  return (
    <div className="job-form__field-with-button">
      <FormField label={TEMPLATE_FIELD_LABELS[name]}>
        <Input {...register(name)} autoComplete="off" />
      </FormField>
      <TemplateFieldButton fieldKey={name} templates={templates} value={value} onChange={(v) => setValue(name, v, { shouldDirty: true })} />
    </div>
  );
}
