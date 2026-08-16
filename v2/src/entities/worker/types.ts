/** See DATA_MODEL.md §6. */
export interface Worker {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export type NewWorkerInput = Pick<Worker, "name">;
