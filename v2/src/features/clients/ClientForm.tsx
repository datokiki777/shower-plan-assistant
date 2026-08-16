import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog } from "@/shared/ui/Dialog";
import { Button } from "@/shared/ui/Button";
import { FormField, Input, Textarea } from "@/shared/ui/fields";
import { clientRepository } from "@/db/repositories";
import { clientFormSchema, CLIENT_FORM_DEFAULTS, type ClientFormValues } from "@/entities/client";
import { normalizeMapsLink } from "@/shared/lib/maps";
import type { Client } from "@/entities/client";
import { useToast } from "@/shared/ui/Toast";

export interface ClientFormProps {
  open: boolean;
  onClose: () => void;
  /** When set, edits this client instead of creating a new one. */
  client?: Client | null;
  onSaved: (client: Client) => void;
}

export function ClientForm({ open, onClose, client, onSaved }: ClientFormProps) {
  const showToast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: CLIENT_FORM_DEFAULTS
  });

  useEffect(() => {
    if (!open) return;
    reset(
      client
        ? {
            fullName: client.fullName,
            address: client.address,
            phone: client.phone,
            googleMapsLink: client.googleMapsLink,
            notes: client.notes
          }
        : CLIENT_FORM_DEFAULTS
    );
  }, [open, client, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const payload = { ...values, googleMapsLink: normalizeMapsLink(values.googleMapsLink) };
    const saved = client
      ? await (async () => {
          await clientRepository.update(client.id, payload);
          return { ...client, ...payload };
        })()
      : await clientRepository.create(payload);
    showToast(client ? "კლიენტი განახლდა." : "კლიენტი დაემატა.", "ok");
    onSaved(saved);
    onClose();
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={client ? "კლიენტის რედაქტირება" : "ახალი კლიენტი"}
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
        <FormField label="სახელი და გვარი" error={errors.fullName?.message}>
          <Input {...register("fullName")} autoComplete="off" />
        </FormField>
        <FormField label="მისამართი">
          <Textarea rows={2} {...register("address")} />
        </FormField>
        <FormField label="ტელეფონი">
          <Input {...register("phone")} type="tel" autoComplete="off" />
        </FormField>
        <FormField label="Google Maps ლინკი" hint="ლინკი ან უბრალო მისამართი - ავტომატურად გადაკეთდება">
          <Input {...register("googleMapsLink")} type="url" autoComplete="off" />
        </FormField>
        <FormField label="შენიშვნები">
          <Textarea rows={2} {...register("notes")} />
        </FormField>
      </form>
    </Dialog>
  );
}
