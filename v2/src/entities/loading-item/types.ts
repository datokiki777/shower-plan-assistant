/**
 * See DATA_MODEL.md §5.
 * `category` is a plain string (not a fixed union) so a future category can
 * be added without a schema migration - the whole point of splitting this
 * out of V1's four hardcoded arrays. The known V1 categories are exported
 * below for convenience/back-compat, not as a hard constraint.
 */
export type LoadingCategory = "trays" | "glass" | "panels" | "extras" | (string & {});

export const KNOWN_LOADING_CATEGORIES: readonly LoadingCategory[] = ["trays", "glass", "panels", "extras"];

export interface LoadingItem {
  id: string;
  loadingListId: string;
  category: LoadingCategory;
  name: string;
  note: string;
  quantity: string | null;
  /** Only meaningful for category "glass" today (V1's per-item `door` field). */
  doorInfo: string | null;
  checked: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type NewLoadingItemInput = Pick<LoadingItem, "loadingListId" | "category"> &
  Partial<Pick<LoadingItem, "name" | "note" | "quantity" | "doorInfo" | "checked">>;
