import { z } from "zod";

export const clientFormSchema = z.object({
  fullName: z.string().trim().min(1, "სახელი აუცილებელია"),
  address: z.string().trim(),
  phone: z.string().trim(),
  googleMapsLink: z.string().trim(),
  notes: z.string().trim()
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;

export const CLIENT_FORM_DEFAULTS: ClientFormValues = {
  fullName: "",
  address: "",
  phone: "",
  googleMapsLink: "",
  notes: ""
};
