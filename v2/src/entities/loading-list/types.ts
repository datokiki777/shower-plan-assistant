/** See DATA_MODEL.md §5. */
export interface LoadingList {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export type NewLoadingListInput = Pick<LoadingList, "title">;
