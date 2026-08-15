# DATA_MODEL.md

V2 entity definitions, derived from the verified V1 schema in
`LEGACY_DATA_AUDIT.md`, reshaped per the rebuild spec's guidance
(separate Client/Job, explicit status, snapshots, normalized Stays).

All timestamps are ISO 8601 strings. All IDs are UUID strings (V1 already
uses `crypto.randomUUID()` everywhere, so IDs can be preserved as-is during
migration — see MIGRATION_PLAN.md §ID preservation).

## 1. Client

```ts
interface Client {
  id: string;
  fullName: string;
  address: string;
  phone: string;
  googleMapsLink: string;   // stored NORMALIZED this time (always a tappable https URL, or ""); V1 normalized only at share/open time
  notes: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}
```
Dexie indexes: `fullName`, `archivedAt`.

## 2. Job

```ts
type JobStatus = "planned" | "active" | "completed" | "archived";

interface Job {
  id: string;
  clientId: string;
  groupId: string | null;

  status: JobStatus;

  jobDate: string | null;        // "YYYY-MM-DD" or null
  jobDurationDays: number | null;

  packageType: string;
  antiSlip: string;
  showerTraySize: string;

  glassPartitionSize: string[];  // V1 stores this as a single string with embedded "\n" for an append-style template field; V2 models the real shape: a string array, same as installables/extraWork/workNotes
  hingedDoorSize: string;

  panelColor: string;
  floorPanelColor: string;
  panelHeight: string;

  installables: string[];
  extraWork: string[];
  workNotes: string[];

  clientSnapshot: {
    fullName: string;
    address: string;
    phone: string;
  };

  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}
```
Dexie indexes: `clientId`, `groupId`, `status`, `jobDate`, compound
`[groupId+status]`.

**Status vs. `archivedAt` — the decision, stated explicitly (per spec §15):**
`status` is the *workflow* state (planned/active/completed), driven by user
action or business meaning. `archivedAt` is a separate, orthogonal
*visibility* flag (this record should stop appearing in normal lists),
mirroring V1's `archived: boolean` but as a timestamp so "when" is recorded
too. A job can be `completed` and not archived (still shown, just done), or
archived regardless of status (hidden everywhere except History). The
current Groups panel = `archivedAt == null`; the current History view =
everything. This is a direct, faithful port of the V1 UX that was already
built and tuned across this conversation, just with a real field instead of
a boolean and an explicit `status` alongside it.

**Migration note:** V1 has no signal for `"planned"`/`"completed"` — only
its own active/archived lifecycle. Migrated jobs are therefore only ever
assigned `status: "active"` or `status: "archived"` (mapped directly from
V1's `archived: false`/`true`), never `"planned"` or `"completed"` — see
`MIGRATION_PLAN.md` §5 for the exact rule. `"planned"` and `"completed"`
are available for jobs created in V2 going forward.

**`clientSnapshot`** exists so a completed job's printed/shared report never
silently changes if the client's contact info is edited later (spec §14).
It is populated from the `Client` at job-creation time and never
auto-updated; editing the live `Client` does not touch old snapshots.

## 3. Group

```ts
interface Group {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;   // NEW in V2 — V1 has no soft-delete for groups; see MIGRATION_PLAN.md risk notes
}
```
Deleting a group in V2 archives it (and, by default, does **not** cascade to
its jobs — jobs keep their `groupId` and simply stop showing under an active
group filter). This directly fixes the V1 behavior flagged as a risk in
`OLD_APP_FEATURE_AUDIT.md` (group delete permanently destroys its clients
today). Permanent group deletion remains possible but becomes an explicit,
separately-confirmed action, not the default one.

## 4. FieldTemplate

```ts
type TemplateFieldKey =
  | "packageType" | "antiSlip" | "showerTraySize"
  | "glassPartitionSize" | "hingedDoorSize"
  | "panelColor" | "floorPanelColor" | "panelHeight"
  | "installables";

interface FieldTemplate {
  id: string;
  fieldKey: TemplateFieldKey;
  value: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
```
One row per template value (V1 stores one array-of-strings per field inside
a single `{id:"main", ...}` record — flattening to one-row-per-value is what
makes per-value `id`s, timestamps, and Dexie indexing possible).
Dexie index: `fieldKey`, compound `[fieldKey+sortOrder]`.

**Append vs. single-select is still a frontend concern, not a schema
concern** — V1 hardcodes this in `TEMPLATE_APPEND_FIELDS`
(`glassPartitionSize`, `installables`); V2 keeps that as a small constant in
`entities/template/`, not a new DB column, since it's a fixed, small,
code-reviewed list rather than user-configurable data.

## 5. LoadingList / LoadingItem

```ts
interface LoadingList {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

type LoadingCategory = "trays" | "glass" | "panels" | "extras" | string; // extensible — see ARCHITECTURE.md §1

interface LoadingItem {
  id: string;
  loadingListId: string;
  category: LoadingCategory;
  name: string;      // V1's "panels"/"extras" items use `name`; "trays"/"glass" use `note` — unified to one field, see MIGRATION_PLAN.md mapping
  note: string;
  quantity: string | null;
  doorInfo: string | null;   // only meaningful for category "glass" today (V1's per-item `door` field)
  checked: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
```
Dexie indexes: `loadingListId`, compound `[loadingListId+category]`.
Splitting `LoadingList`/`LoadingItem` into two tables (V1 nests four typed
arrays inside one record) is what makes "add a 5th category later" not
require a schema migration — a new category is just a new string value in
existing rows, not a new array field.

## 6. Worker / Stay

```ts
interface Worker {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

interface Stay {
  id: string;
  workerId: string;
  entryDate: string;          // "YYYY-MM-DD"
  exitDate: string | null;    // "YYYY-MM-DD" or null = currently inside
  createdAt: string;
  updatedAt: string;
}
```
Dexie indexes: `workerId`, compound `[workerId+entryDate]`.

**Decision (per spec §24's request to document it):** stays become a real
table, not a nested array (V1 nests `stays[]` inside the worker record).
This is what lets Dexie index and query "all stays in the last 180 days"
directly instead of loading every worker's full history into memory to
compute the rolling window, which matters once a worker has years of stays.
The 90/180 calculation functions (`features/periods/domain/*.ts`) take a
worker's stays as a plain array argument either way, so porting the existing
pure-function logic from `js/periods.js` is unaffected by this table split.

## 7. MigrationRecord

```ts
interface MigrationRecord {
  id: string;
  source: "shower-plan-assistant-v1";
  sourceExportId: string;
  sourceVersion: number;
  importedAt: string;
  originalExportedAt: string;
  recordCounts: Record<string, number>;
  warnings: string[];
}
```
Purpose: duplicate-import protection (spec §46) — before importing, check
whether a `MigrationRecord` with this `sourceExportId` already exists and
warn instead of silently re-importing.

## 8. Relationships summary

```
Client 1---* Job (Job.clientId)
Group  1---* Job (Job.groupId, nullable)
Worker 1---* Stay (Stay.workerId)
LoadingList 1---* LoadingItem (LoadingItem.loadingListId)
FieldTemplate *---1 (fieldKey)   -- not a relation to another entity, just grouped by key
```

No entity has a hard foreign-key constraint at the Dexie level (IndexedDB
doesn't enforce them); repositories are responsible for referential
integrity (e.g. `ClientRepository.archive()` does not need to touch `Job`
rows, since `Job.clientId` staying valid after a client is archived is
correct — an archived client's historical jobs must still resolve via
`clientSnapshot` regardless).
