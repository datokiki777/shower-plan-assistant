# LEGACY_DATA_AUDIT.md

Exact, verified schema of the V1 IndexedDB database, read directly from
`js/app.js`, `js/loading.js`, and `js/periods.js`. No fields are inferred —
every field below is either set in `createEmptyX()`/factory functions or
written by a `putRecord`/`putX` call in the current codebase.

## Database

- **Name:** `shower-plan-assistant`
- **Current version:** `5`
- **Access pattern:** a single hand-written `openDb()` in `app.js` opens one
  shared connection (memoized in `dbPromise`), exposed to the other two mode
  scripts via `window.AppDB = { putRecord, getRecords, clearRecords, deleteRecord, LOADING_STORE, PERIODS_STORE }`.
  `loading.js` and `periods.js` never touch `indexedDB` directly.
- **Generic helpers** (apply to every store): `putRecord(store, record)`,
  `getRecords(store)` (returns **all** records, sorted client-side by
  `String(b.createdAt).localeCompare(String(a.createdAt))` — i.e. newest
  first, string-lexicographic on the ISO timestamp), `clearRecords(store)`,
  `deleteRecord(store, id)`. **No indexes beyond the implicit keyPath exist.**
  Every "query" in the app is `getAll()` followed by an in-memory
  `.filter()/.sort()`. This is the main thing Dexie + real indexes must fix.

## Object stores

### 1. `reports` (keyPath: `id`)

One record = one client/job (V1 does not separate these — see
`OLD_APP_FEATURE_AUDIT.md` and `DATA_MODEL.md`).

```
{
  id: string (crypto.randomUUID()),
  createdAt: string (ISO 8601; rewritten to "now" on every save, not just creation — see risk below),
  clientName: string,
  address: string,
  phone: string,
  googleMapsLink: string,          // raw user input; normalized to a tappable https URL only at share/open time, not stored normalized
  jobDate: string,                 // "" or "YYYY-MM-DD" (native <input type=date>)
  jobDurationDays: string,         // "" or "1".."7" (native <select>, stored as string)
  groupId: string,                 // "" or a groups.id — required by the UI (save is blocked without one) but NOT DB-enforced
  packageType: string,
  showerTraySize: string,
  antiSlip: string,
  glassPartitionSize: string,      // free text, may contain embedded "\n" (multi-line textarea, append-style template field)
  hingedDoorSize: string,
  panelColor: string,
  floorPanelColor: string,
  panelHeight: string,
  installables: string[],          // newline-split textarea -> array
  extraWork: string[],             // newline-split textarea -> array
  workNotes: string[],             // newline-split textarea -> array
  sketch: object | null,           // opaque payload owned by js/sketch-editor.js (BathroomSketch); NOT further specified here since the sketch editor is out of V2 scope
  archived: boolean                // soft-delete flag added late in V1's life; false = shows in the active Groups panel, true = only in History
}
```

**Risks / quirks found:**
- `createdAt` is overwritten to `new Date().toISOString()` on **every** save
  (new or edit), not just on first creation. It is really "last saved at",
  and both display ("დამატებულია: …") and default sort order depend on this.
  V2 must decide explicitly between `createdAt` (immutable) and `updatedAt`
  (mutable) — do not conflate them like V1 does.
- `groupId` can be an empty string or point at a group that no longer exists
  (deleting a group cascades a **permanent** delete of its reports today, so
  orphaned `groupId`s should not currently occur, but nothing in the schema
  prevents it — e.g. a future bug or manual DB edit could produce one). The
  UI already has a fallback bucket ("ჯგუფის გარეშე (ძველი ჩანაწერები)") for
  this case in the History view.
- No `updatedAt`, no `status` enum — `archived: boolean` is the only status
  signal that exists.
- `sketch` is an opaque nested object with no documented shape here; treat as
  opt-out data for migration purposes (see MIGRATION_PLAN.md) since the
  sketch editor is out of scope.

### 2. `groups` (keyPath: `id`)

```
{
  id: string (crypto.randomUUID()),
  name: string,
  createdAt: string (ISO 8601)
}
```
No `archived`/soft-delete concept — deleting a group in V1 deletes it and
cascades a **permanent** delete of every `reports` record with that
`groupId` (with an explicit confirm warning about this). No status field.

### 3. `loadingLists` (keyPath: `id`)

```
{
  id: string (crypto.randomUUID()),
  createdAt: string (ISO 8601),
  title: string,
  trays:  Array<{ id: string, note: string, checked: boolean }>,
  glass:  Array<{ id: string, note: string, door: string, checked: boolean }>,
  panels: Array<{ id: string, name: string, qty: string, checked: boolean }>,
  extras: Array<{ id: string, name: string, qty: string, checked: boolean }>
}
```
Categories are hardcoded as four fixed array fields, not a generic
`category` field on a flat item list — this is the main thing
`OLD_APP_FEATURE_AUDIT.md` flags as **IMPROVE** for V2's `LoadingItem` model.
No `archived`/status field; items only disappear via whole-list delete.

### 4. `periodsWorkers` (keyPath: `id`)

```
{
  id: string (crypto.randomUUID()),
  name: string,
  createdAt: string (ISO 8601),
  stays: Array<{
    id: string,
    entry: string,      // "YYYY-MM-DD"
    exit: string | null // "YYYY-MM-DD" or null while still "inside"
  }>
}
```
Stays are nested inside the worker record, not a normalized/queryable table.
No `archivedAt` on the worker. The 90/180 math (`js/periods.js`) treats a
worker with any `stays` entry lacking `exit` as "currently inside"; only one
such open stay is expected at a time (not schema-enforced).

### 5. `fieldTemplates` (keyPath: `id`)

**Single record only**, always written with `id: "main"`:

```
{
  id: "main",
  createdAt: string (ISO 8601, updated on every change),
  packageType: string[],
  antiSlip: string[],
  showerTraySize: string[],
  glassPartitionSize: string[],
  hingedDoorSize: string[],
  panelColor: string[],
  floorPanelColor: string[],
  panelHeight: string[],
  installables: string[]
}
```
Order within each array is the display/pick order (user-reorderable via
up/down buttons) — there is no explicit `sortOrder` field, array position
**is** the sort order. `glassPartitionSize` and `installables` are the two
fields the UI treats as "append" fields (clicking a template value appends a
line rather than replacing the whole field) — this distinction
(`TEMPLATE_APPEND_FIELDS` in `app.js`) is hardcoded in frontend logic, not
stored in the data.

## Not stored in IndexedDB

- **Current mode** (`ანგარიში`/`დატვირთვა`/`პერიოდები`) — `localStorage`,
  key `shower-plan-assistant-mode`. Pure UI preference, not business data —
  fine to leave as `localStorage` in V2 too, per the rebuild spec's own rule
  ("localStorage may only be used for tiny UI preferences").
- Nothing else touches `localStorage` or `sessionStorage`.
- No server-side data — the Express server (§5 of the feature audit) is
  entirely stateless per-request; it never writes to a database.

## `config.js`

Present at repo root, loaded by `index.html`. Needs a one-line content check
before Phase 1 (not reproduced here to avoid guessing) — flagged so it is not
silently skipped during the export/migration work.

## Confirmed absence of anything else

Searched the full `js/*.js` for `indexedDB`, `localStorage`, and
`sessionStorage` usage: the five stores above, plus the one `localStorage`
mode key, are the **entire** persistent footprint of V1. There is no hidden
sixth store, no service-worker-based storage of business data (the service
worker only caches static app-shell assets), and no cookies.
