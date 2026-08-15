# ARCHITECTURE.md

Proposed architecture for V2. This document describes structure and
strategy, not the audit (see `OLD_APP_FEATURE_AUDIT.md`) or the exact schema
(see `DATA_MODEL.md`).

## 1. App structure

```
src/
  app/
    router/            # React Router route tree, lazy-loaded route modules
    providers/          # QueryClient-free composition root: Zustand stores, ConfirmDialog/Toast providers, PWA update provider
    layout/              # App shell: top bar, section nav, offline/update banners

  routes/                # Thin route components; compose feature components, no business logic

  shared/
    ui/                  # Reusable primitives: Button, Card, Dialog, ConfirmDialog, Toast, EmptyState, FormField, SearchInput...
    lib/                 # Generic non-domain utilities (date formatting via date-fns, escapeHtml equivalent, id generation)
    hooks/               # useConfirm(), useDebouncedValue(), useOnlineStatus()...
    constants/
    types/               # Cross-cutting types only (Result<T>, PaginatedResult<T>, etc.)

  entities/
    client/              # Client type, small pure helpers (formatClientLabel, etc.) — NOT React
    job/
    group/
    template/
    worker/
    stay/
    loading-list/
    loading-item/
    migration-record/

  features/
    dashboard/
    clients/
    jobs/
    groups/
    templates/
    loading/
    periods/
    search/
    backup/
    legacy-import/
    settings/
    # each feature/: components/, hooks/, domain/ (pure logic), api.ts (repository calls), types.ts

  db/
    database.ts          # Dexie class + db.version(N) chain
    schema/               # Per-table Dexie schema fragments if the chain grows large
    repositories/         # ClientRepository, JobRepository, GroupRepository, TemplateRepository, LoadingRepository, WorkerRepository, StayRepository, MigrationRepository
    migrations/           # Dexie upgrade() callbacks, one file per version bump

  services/               # Cross-feature orchestration that doesn't belong to one entity: ShareService (html2canvas + Web Share, used by both Jobs and Loading), PdfExportService

  tests/
    fixtures/              # Representative V1 export fixtures for migration tests (see MIGRATION_PLAN.md §Testing)
```

Rule of thumb carried over from the rebuild spec: **UI depends on
repositories, never on Dexie directly.** A component calls
`useJobs(groupId)` (a hook wrapping `JobRepository.listByGroup`), never
`db.jobs.where(...)`.

## 2. Feature boundaries

- A **feature** owns a route, its components, its domain logic, and its
  repository calls. Features do not import each other's `components/`; if
  two features need the same UI, it belongs in `shared/ui/`.
- **`entities/`** hold the shape of the domain (types + tiny pure helpers)
  shared by multiple features — e.g. both `features/clients` and
  `features/jobs` need the `Client` type and a `formatClientLabel()` helper;
  that lives in `entities/client/`, not duplicated.
- **`services/`** exist for the handful of things V1 duplicated across modes
  and V2 must not: the WhatsApp/image-share pipeline (`html2canvas` +
  `navigator.share` + download/clipboard fallback) is identical between
  Jobs and Loading in V1 today — one `ShareService`, not two copies.

## 3. Repository pattern

Each repository is a small class/module with a narrow, typed contract, e.g.:

```ts
interface JobRepository {
  getById(id: string): Promise<Job | undefined>;
  listByGroup(groupId: string, opts?: { status?: JobStatus }): Promise<Job[]>;
  listByClient(clientId: string): Promise<Job[]>;
  search(query: string, opts?: { limit?: number }): Promise<Job[]>;
  create(input: NewJobInput): Promise<Job>;
  update(id: string, patch: Partial<Job>): Promise<void>;
  archive(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  delete(id: string): Promise<void>; // permanent — only reachable from an explicit "History" / archive view, mirroring the V1 UX lesson already learned
}
```

`Local*Repository` implementations wrap Dexie today. The contract is written
so a future `RemoteJobRepository` or `SyncingJobRepository` can be swapped in
without touching any component — this is the concrete mechanism behind spec
§10's "ready for future cloud/backend integration."

## 4. Dexie strategy

- One `Dexie` subclass in `db/database.ts`, versioned from `1`.
- Every schema change is a new `db.version(n).stores({...}).upgrade(tx => {...})`
  block, never an edit to an existing version block.
- Indexes are chosen from the actual query patterns identified in
  `LEGACY_DATA_AUDIT.md` (V1 has none — everything is `getAll()+filter()`):
  - `jobs`: `groupId`, `clientId`, `status`, `jobDate`, and a compound
    `[groupId+status]` for the "active jobs in this group" query that powers
    the current Groups panel.
  - `clients`: `fullName` (for search), `archivedAt`.
  - `templates`: `fieldKey`.
  - `stays`: `workerId`, `entryDate`.
  - `loadingItems`: `loadingListId`, `category`.
- `reports.sketch` (opaque blob) is explicitly **not** modeled in V2's
  `Job` — the sketch editor is out of scope (spec §2/§56) and the field is
  parked for the future sketch module, not silently dropped or half-ported.

## 5. State management strategy

| State type | Tool | Example |
|---|---|---|
| Persistent business data | Dexie via repositories | clients, jobs, groups, templates, loading lists, workers, stays |
| Form editing | React Hook Form (+ Zod resolver) | job form, client form, worker form |
| Selected IDs, active filters, transient UI flags | Zustand (small, feature-scoped stores — not one giant store) | `useJobsFilterStore`, `useSelectedGroupStore` |
| Local visual interaction | Component state | dialog open/closed, hover, accordion expand |
| Confirmations, toasts | `shared/ui` primitives + hooks | `useConfirm()` mirrors V1's `window.AppConfirm` but as a hook |

No feature is allowed to mirror an entire Dexie table into a Zustand store —
that was flagged as an anti-pattern in the rebuild spec and there is no
reason to do it: Dexie's `liveQuery` (or a thin `useLiveQuery` wrapper) gives
reactive reads directly from IndexedDB.

## 6. Routing

React Router, code-split per feature (`React.lazy` + route-level chunks):

```
/                     -> Dashboard
/jobs                 -> Jobs list (default: active, grouped)
/jobs/:id             -> Job detail/edit
/clients              -> Clients list
/clients/:id          -> Client detail (their jobs)
/groups               -> Groups management
/loading              -> Loading lists
/loading/:id
/periods              -> Workers
/periods/:id
/templates            -> Template management
/settings/backup
/settings/legacy-import
```

Bottom/mobile nav shows a small fixed set (Dashboard, Jobs, Loading, Periods)
per spec §32; Clients/Templates/Settings are reachable from a secondary
menu so the nav doesn't grow unbounded as features are added later.

## 7. PWA

- `vite-plugin-pwa` (Workbox-generated service worker) instead of the
  hand-maintained `ASSETS` array + manual `CACHE` version string V1 uses —
  removes an entire class of "forgot to bump the cache version" bugs.
- `registerType: 'prompt'`, with a small custom "update available" dialog
  reusing the same `ConfirmDialog` primitive V1 already proved out
  (`showUpdateDialog`), so updates never silently reload and never touch
  IndexedDB.
- Manifest/icons carried over unchanged from V1 (already correct: "Plans"
  name, blue "P" icon set at 192/512/favicon sizes).

## 8. Performance strategy

- Every list view is a repository query with an index, not `getAll()` — see
  §4.
- Search (`features/search`) debounces input (~200ms) and queries Dexie
  indexes rather than filtering an in-memory array — this directly replaces
  V1's `runClientSearch`, which currently does `getReports()` (all records)
  + `.filter()` on every keystroke and only works because V1's dataset is
  still small.
- Dashboard queries are bounded (`limit`/date-range), never "load everything
  and compute in JS."
- Virtualization (`@tanstack/react-virtual` or similar) is added to the Jobs
  and Clients list views only if/when Phase 9's generated-large-dataset
  testing shows it's actually needed — not built speculatively.

## 9. Future extension points

- `services/PdfExportService` and the AI-analysis pipeline the user asked
  about both plug in as a new `features/document-analysis/` module later,
  calling a `RemoteJobRepository`-style boundary rather than reaching into
  Dexie directly — this is the concrete reason the repository pattern
  matters now even though there's no backend yet.
- The sketch editor returns as `features/sketch/`, with its opaque payload
  attached to `Job.sketch` (or a new `JobAttachment` entity) once it's
  rebuilt, without needing to touch the Job schema's other fields.
