/** See DATA_MODEL.md §1. */
export interface Client {
  id: string;
  fullName: string;
  address: string;
  phone: string;
  /** Always a tappable https URL, or "". Stored pre-normalized (unlike V1,
   * which only normalized at share/open time - see DATA_MODEL.md §1). */
  googleMapsLink: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export type NewClientInput = Pick<Client, "fullName" | "address" | "phone" | "googleMapsLink" | "notes">;
