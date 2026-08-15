# MIGRATION_PLAN.md

Concrete plan for getting real V1 data into V2 without loss, referencing the
exact schemas in `LEGACY_DATA_AUDIT.md` and `DATA_MODEL.md`.

## 1. Legacy database (source)

- IndexedDB `shower-plan-assistant`, version 5, stores: `reports`, `groups`,
  `loadingLists`, `periodsWorkers`, `fieldTemplates` (full field-by-field
  shapes in `LEGACY_DATA_AUDIT.md`).
- Lives entirely in the browser; there is no server copy anywhere.

## 2. Phase 1 deliverable: V1 export button

Add one feature to the **existing, live** V1 app (this repo's `main`
branch, not this planning branch): an "Export data for V2" action.

- Reads all five stores via the existing generic `getRecords(store)` helper
  already in `app.js` — no new DB code needed on the V1 side.
- Produces the JSON format in §3 below and triggers a file download,
  reusing the exact `Blob` + anchor-click download pattern V1 already uses
  for the Periods module's Backup JSON (`js/periods.js`) — proven to work in
  this app already.
- **Read-only.** Does not modify, clear, or touch the V1 database in any
  way. Purely additive to `main`.
- Ships and is used **before** any V2 cutover work begins.

## 3. V1 legacy export JSON format

```json
{
  "format": "shower-plan-assistant-legacy-export",
  "sourceVersion": 1,
  "sourceDbVersion": 5,
  "exportVersion": 1,
  "exportId": "UUID generated at export time",
  "exportedAt": "ISO 8601 timestamp",
  "data": {
    "reports": [ /* raw records from the `reports` store, unmodified */ ],
    "groups": [ /* raw records from `groups` */ ],
    "templates": [ /* the single fieldTemplates record, as-is */ ],
    "loadingLists": [ /* raw records from `loadingLists` */ ],
    "workers": [ /* raw records from `periodsWorkers`, including nested `stays[]` */ ]
  }
}
```
Two distinct version fields, deliberately not conflated:
- **`sourceVersion`** — the version of *this export/legacy-import format
  itself*. Always `1` for the current format. This is what the V2 importer's
  compatibility check is against (§10 below).
- **`sourceDbVersion`** — the V1 app's actual IndexedDB schema version
  (`DB_VERSION` in `js/app.js`, currently `5`) at export time. Informational
  only — V2 may inspect it for diagnostics or future format-specific
  handling, but it is never what gates whether an import is accepted.

Every array is the **unmodified** `getRecords()` output for that store —
the export step does no transformation. All transformation happens on the
V2 import side (§5), so the export code stays trivial and low-risk to add
to the live V1 app, and the same raw JSON can be re-processed later if the
V2 mapping logic needs a fix.

## 4. V2 legacy importer

Location: **Settings → Data → Import from Shower Plan Assistant V1**,
implemented as `features/legacy-import/`:

```
features/legacy-import/
  parseLegacyExport.ts      # JSON.parse + basic shape check
  validateLegacyExport.ts   # Zod schema for the format above
  transformV1ToV2.ts        # pure functions, one per store, see §5
  importLegacyData.ts       # orchestrates: validate -> preview -> (user confirms) -> transaction -> MigrationRecord
```
This is separate from V2's own Backup/Restore (`features/backup/`) — a
different format, a different (one-directional, versioned) purpose, and it
is **not** offered again once a given `exportId` has been imported (§8).

## 5. V1 -> V2 transformation, field by field

### `reports[]` -> `Client` + `Job`

This is the only non-trivial mapping. Rule: **one `reports` record always
produces exactly one `Job`**, and either reuses an existing matching
`Client` or creates a new one (see §6 for the matching rule — no fuzzy
merging).

| V1 `reports` field | V2 destination |
|---|---|
| `id` | `Job.id` (preserved as-is) |
| `createdAt` | `Job.createdAt` **and** `Job.updatedAt` (V1 conflates the two — see LEGACY_DATA_AUDIT.md risk note; V2 cannot recover the true original creation time, so both are set equal from the one timestamp V1 has) |
| `clientName` | `Client.fullName` (on the matched/created Client) **and** `Job.clientSnapshot.fullName` |
| `address` | `Client.address` + `Job.clientSnapshot.address` |
| `phone` | `Client.phone` + `Job.clientSnapshot.phone` |
| `googleMapsLink` | `Client.googleMapsLink`, run through the same normalization helper V1 already has (`normalizeMapsLink` in `app.js`) so it's stored pre-normalized in V2 |
| `jobDate` | `Job.jobDate` (already `"YYYY-MM-DD"` or `""` -> `null`) |
| `jobDurationDays` | `Job.jobDurationDays` (string -> number, `""` -> `null`) |
| `groupId` | `Job.groupId`, remapped through the groups ID-mapping table (§7); if the V1 `groupId` doesn't match any exported group (orphaned reference, see risk in LEGACY_DATA_AUDIT.md), set to `null` and add a migration warning |
| `packageType`, `antiSlip`, `showerTraySize`, `hingedDoorSize`, `panelColor`, `floorPanelColor`, `panelHeight` | copied as-is |
| `glassPartitionSize` | split on `\r?\n`, trimmed, empty lines dropped -> `Job.glassPartitionSize: string[]` (matches how V1's own append-template feature already treats this field's content) |
| `installables`, `extraWork`, `workNotes` | already arrays in V1 — copied as-is |
| `sketch` | **dropped**, not migrated (sketch editor out of scope — spec §2/§56). Logged as a warning if non-null so the user knows a job had a sketch that didn't come across, rather than silently losing it without mention. |
| `archived` (boolean) | `Job.status = archived ? "archived" : "active"`, `Job.archivedAt = archived ? createdAt : null`. **Rationale (corrected):** V1 already has a working active/archived lifecycle (`archived: false` = currently active in the app today, `archived: true` = archived). Migration must be zero-surprise: it maps that lifecycle directly (`false` → `"active"`, `true` → `"archived"`) rather than guessing a richer status like `"completed"`. Nothing about a non-archived V1 report implies "finished" — inventing that would misrepresent real V1 records. The richer `"planned"`/`"completed"` states remain available in V2's `JobStatus` for jobs created after migration, but are never assigned to migrated records. |

### `groups[]` -> `Group`

Direct 1:1 mapping, `id`/`name`/`createdAt` preserved, `updatedAt = createdAt`,
`archivedAt = null`.

### `templates` (single record) -> `FieldTemplate[]`

For each of the 9 known field keys, for each string in that key's array (in
array order), create one `FieldTemplate` row with `sortOrder` = its index in
the original array. The wrapper record's own `id`/`createdAt` are discarded
(V2 has no equivalent "one row per config blob" concept).

### `loadingLists[]` -> `LoadingList` + `LoadingItem[]`

- `id`/`title`/`createdAt` preserved on `LoadingList`; `updatedAt = createdAt`,
  `archivedAt = null`.
- For each of the four V1 arrays (`trays`, `glass`, `panels`, `extras`),
  each entry becomes one `LoadingItem` with `category` set to that array's
  name, `loadingListId` = the parent list's `id`, `id` preserved from the
  V1 item per the rule in §7, `sortOrder` = its index in the original array.
  Field mapping per category:
  - `trays`: `note` -> `LoadingItem.note`, `name` left `""`.
  - `glass`: `note` -> `note`, `door` -> `doorInfo`, `name` left `""`.
  - `panels`/`extras`: `name` -> `name`, `qty` -> `quantity`, `note` left `""`.
  - `checked` copied as-is in all four.

### `workers[]` -> `Worker` + `Stay[]`

- `id`/`name`/`createdAt` preserved on `Worker`; `updatedAt = createdAt`,
  `archivedAt = null`.
- Each entry in `stays[]` becomes one `Stay` row: `id`/`entry`->`entryDate`/
  `exit`->`exitDate` preserved, `workerId` = the parent worker's `id`,
  `createdAt`/`updatedAt` set to the worker's `createdAt` (V1 stays have no
  own timestamp).

## 6. Client deduplication strategy

**Conservative by design, per spec §43.** For each `reports` record being
migrated:

1. Normalize `clientName` (trim, collapse whitespace, casefold) and take
   `phone` as-is (trimmed).
2. Look for an **already-created-in-this-import** `Client` (not yet
   persisted — dedupe within the batch, since V1 duplicates the same client
   across many `reports` rows by design) matching **both**:
   - normalized `fullName` is identical, **and**
   - `phone` is identical and non-empty, **or** `address` is identical and
     non-empty (if phone is empty on both records).
3. If matched: reuse that `Client`, add this job to it.
4. If not matched: create a new `Client`.
5. **No fuzzy/similarity matching, ever.** Two different-looking names, or
   a matching name with conflicting phone/address, always produce two
   separate `Client` records. This means a genuine "same person, typo'd
   phone number" case will produce two clients — acceptable and correct per
   spec §43 ("preserve two possible duplicates" over incorrect merging);
   users can merge manually later if a "merge clients" feature is added.

This matching only runs **within a single import**, against records already
created during that same import — it does not scan pre-existing V2 clients
from a previous import, since duplicate-import protection (§8) is expected
to prevent the same export ever being imported twice.

## 7. ID preservation

- `reports.id` -> `Job.id`: preserved directly.
- `groups.id` -> `Group.id`: preserved directly.
- `periodsWorkers.id` -> `Worker.id`, its `stays[].id` -> `Stay.id`:
  preserved directly.
- `loadingLists.id` -> `LoadingList.id`: preserved directly.
- `LoadingItem.id`: **deterministic rule** — if the V1 nested item already
  has an `id` (true for every category in the current schema; see
  `LEGACY_DATA_AUDIT.md` §3), that exact `id` is preserved on the new
  `LoadingItem` row. A new UUID is generated only for the (currently
  theoretical, but possible on malformed/old data) case of a nested item
  with no `id` at all. No item is ever re-generated an ID just because it
  came from a nested array.
- `Client.id` is **always newly generated** — V1 has no client entity to
  preserve an ID from.
- An explicit in-memory mapping table is built during import and attached to
  the `MigrationRecord.recordCounts`/logs for traceability:
  `legacyReportId -> newJobId` (identity, but logged for verification),
  `legacyGroupId -> newGroupId` (identity), and a separate
  `legacyReportId -> resolvedClientId` map (since this one is *not*
  identity — it's the output of the dedup step in §6).

## 8. Duplicate-import protection

Before running any transformation:
1. Read `data.exportId` from the file.
2. Query `MigrationRecord` (Dexie) for an existing row with
   `sourceExportId === exportId`.
3. If found: show "This backup (exported <date>) was already imported on
   <date>. Importing again will create duplicate jobs/clients." and require
   an explicit extra confirmation before proceeding (not a hard block — a
   user might legitimately want to re-import into a fresh V2 database, e.g.
   after clearing it for testing).
4. On successful import, write a new `MigrationRecord` row.

## 9. Migration transaction & rollback

- The whole import (`Client`, `Job`, `Group`, `FieldTemplate`,
  `LoadingList`, `LoadingItem`, `Worker`, `Stay`, `MigrationRecord` writes)
  runs inside one `db.transaction('rw', [...all these tables], async () => {...})`.
- Dexie transactions auto-rollback on any thrown error — no manual rollback
  code needed, but the importer must not catch-and-swallow errors inside the
  transaction callback, or Dexie won't know to roll back.
- If the transaction throws, the user sees the actual error and the database
  is left exactly as it was before the import started (verified by a test —
  see §Testing).

## 10. Verification / preview UX

Before writing anything:
1. Parse + Zod-validate the file. Reject with a clear message if `format`
   doesn't match, or if `sourceVersion !== 1` (the only supported
   legacy-export format version right now — this is the gating check, not
   `sourceDbVersion`). `sourceDbVersion` is read and may be surfaced in the
   preview for the user's/support's information (e.g. "exported from V1
   schema v5"), but a difference in `sourceDbVersion` alone never blocks an
   import — the export format (§3) already normalizes away V1's internal
   schema-version churn.
2. Run the transformation **in memory only** (no writes) to get final counts
   and warnings (orphaned `groupId`s, dropped sketches, etc. — see §5).
3. Show the preview:
   ```
   V1 Backup detected
   Exported: 15 August 2026
   Found:
     Jobs: 327
     Groups: 6
     Templates: 42
     Loading lists: 21
     Workers: 14
   Warnings: 2
     - 1 job referenced a deleted group and was left ungrouped
     - 1 job had a sketch that was not migrated
   ```
4. User taps "Import" -> run §9's transaction with the **same** already-computed
   transform result (do not recompute) -> show the migration summary (spec §45)
   with the same counts, now "imported" instead of "found".

## 11. Testing (spec §53)

Fixtures under `tests/fixtures/legacy/`, each a small hand-written JSON file
matching the real V1 export format:

- `standard-report.json` — one client, one active job, one group.
- `archived-report.json` — `archived: true` -> verify `status:"archived"`.
- `multi-group.json` — several groups, jobs split across them.
- `templates.json` — including at least one append-field
  (`glassPartitionSize`) with multi-line content.
- `loading-list.json` — all four categories populated.
- `worker-history.json` — a worker with 3+ stays, including one open
  (`exit: null`) stay.
- `missing-optional-fields.json` — empty strings / absent keys where V1
  allows them, to verify the importer doesn't crash on sparse data.
- `duplicate-looking-clients.json` — two reports with the same name but
  different phone numbers -> verify **two** clients are created (§6 rule).
- `malformed.json` — invalid JSON / wrong `format` string -> verify a clean
  validation error, no partial writes.
- `unsupported-version.json` — `sourceVersion: 99` -> verify a clean
  rejection.
- Repeated-import test: import `standard-report.json` twice -> verify the
  second attempt is flagged per §8 (not silently duplicated).
- Rollback test: a fixture engineered to fail partway through the
  transaction (e.g. a job referencing a client-matching rule that throws) ->
  verify the database has zero new rows afterward.

## 12. Cutover process (spec §61 Phase 10, restated concretely)

1. V1 (`main`) keeps running in production, untouched, through all of this.
2. Ship the V1 export button (Phase 1) to production first, independently of
   any V2 work — so a safety export is possible immediately, not gated on
   V2 being finished.
3. Once V2 is stable through Phase 9: tag the last pre-cutover V1 commit as
   `legacy-v1-final`.
4. Take a fresh export from the real, in-use V1 app; save the JSON outside
   the browser (not just relying on IndexedDB).
5. Deploy V2 to a **separate URL/path** first (not overwriting the live V1
   URL) for a manual verification pass:
   - import the JSON, review the preview screen,
   - confirm the import,
   - compare V1 vs. V2 record counts against the summary,
   - open several real historical jobs and check values against V1,
   - check groups, templates, loading lists, worker stay histories by hand.
6. Only after that manual pass succeeds, point the production URL at V2.
7. V1's IndexedDB is never programmatically cleared as part of this process
   — it simply stops being the URL users load. It remains present in the
   browser as a fallback for as long as the user doesn't clear site data.
