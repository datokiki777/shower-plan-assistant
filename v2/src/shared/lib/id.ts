/** Generates a UUID string. All entity IDs in this app are UUID strings,
 * matching V1 (which already used crypto.randomUUID() everywhere) so legacy
 * IDs can be preserved as-is during migration - see MIGRATION_PLAN.md §7. */
export function createId(): string {
  return crypto.randomUUID();
}

/** Current time as an ISO 8601 string - the timestamp format used by every entity. */
export function nowIso(): string {
  return new Date().toISOString();
}
