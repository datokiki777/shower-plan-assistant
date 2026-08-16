/** A group can only ever be permanently deleted if it has zero jobs
 * attached (active or archived). Archiving is always safe and available
 * regardless of job count - see DATA_MODEL.md §3 and the explicit
 * "never reproduce V1's destructive group deletion" requirement. */
export function canPermanentlyDeleteGroup(jobCount: number): boolean {
  return jobCount === 0;
}
