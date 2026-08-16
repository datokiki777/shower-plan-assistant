/**
 * See DATA_MODEL.md §3.
 * Unlike V1, deleting a group archives it by default (does not cascade a
 * permanent delete of its jobs) - see OLD_APP_FEATURE_AUDIT.md risk note.
 */
export interface Group {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export type NewGroupInput = Pick<Group, "name">;
