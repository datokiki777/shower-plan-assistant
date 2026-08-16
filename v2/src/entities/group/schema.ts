import { z } from "zod";

export const groupFormSchema = z.object({
  name: z.string().trim().min(1, "დასახელება აუცილებელია")
});

export type GroupFormValues = z.infer<typeof groupFormSchema>;
