/**
 * See DATA_MODEL.md §6. A real, normalized, queryable table - not nested
 * inside Worker like V1's `stays[]` - so Dexie can index "stays in the last
 * 180 days" directly instead of loading a worker's entire history into
 * memory. The 90/180 domain functions still just take a plain array of
 * these as an argument, so porting V1's pure functions is unaffected.
 */
export interface Stay {
  id: string;
  workerId: string;
  entryDate: string; // "YYYY-MM-DD"
  exitDate: string | null; // "YYYY-MM-DD" or null = currently inside
  createdAt: string;
  updatedAt: string;
}

export type NewStayInput = Pick<Stay, "workerId" | "entryDate">;
