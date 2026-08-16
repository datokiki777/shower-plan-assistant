import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog } from "@/shared/ui/Dialog";
import { Button } from "@/shared/ui/Button";
import { FormField, Input } from "@/shared/ui/fields";
import { useToast } from "@/shared/ui/Toast";
import { groupRepository } from "@/db/repositories";
import { groupFormSchema, type GroupFormValues } from "@/entities/group";
import type { Group } from "@/entities/group";

export interface GroupFormProps {
  open: boolean;
  onClose: () => void;
  group: Group | null;
  onSaved: () => void;
}

/** Rename dialog for an existing group - mobile-friendly replacement for the
 * previous window.prompt() implementation, matching the ClientForm/JobForm
 * pattern (Dialog + React Hook Form + Zod) used everywhere else in V2. */
export function GroupForm({ open, onClose, group, onSaved }: GroupFormProps) {
  const showToast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: { name: "" }
  });

  useEffect(() => {
    if (open) reset({ name: group?.name ?? "" });
  }, [open, group, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!group) return;
    await groupRepository.rename(group.id, values.name);
    showToast("ჯგუფი გადარქმეულია.", "ok");
    onSaved();
    onClose();
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="ჯგუფის გადარქმევა"
      footer={
        <>
          <Button onClick={onClose}>გაუქმება</Button>
          <Button variant="primary" onClick={() => void onSubmit()} disabled={isSubmitting}>
            შენახვა
          </Button>
        </>
      }
    >
      <form onSubmit={(e) => void onSubmit(e)}>
        <FormField label="დასახელება" error={errors.name?.message}>
          <Input {...register("name")} autoComplete="off" autoFocus />
        </FormField>
      </form>
    </Dialog>
  );
}
