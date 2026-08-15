# OLD_APP_FEATURE_AUDIT.md

Audit of `shower-plan-assistant` (branded "Plans" in the UI) as of the commit this
branch was cut from. Every feature is tagged **KEEP**, **IMPROVE**, or **REMOVE**.

The app is a single-page vanilla-JS PWA with three modes switched by a pill toggle:
**ანგარიში** (Report/Jobs), **დატვირთვა** (Loading), **პერიოდები** (Periods/Workers).
There is also a mostly-unused Express + OpenAI PDF-analysis server that is not wired
into the frontend.

---

## 1. Report / Jobs mode (`js/app.js`)

| Feature | Verdict | Notes |
|---|---|---|
| Client form (name, address, phone, maps link, job date, job duration, group, package/material fields) | **KEEP** | Core entity. Becomes `Client` + `Job` in V2 (see DATA_MODEL.md §3). |
| Collapsible "ახალი სამუშაო" form, collapsed by default | **KEEP** | Good mobile pattern; recreate as a route/dialog rather than a hide/show div. |
| Groups (create/rename/delete, "+ client" from a group card) | **KEEP** | Maps to V2 `Group`. Group delete currently **cascades and permanently deletes its clients** — flagged as a risk in MIGRATION_PLAN.md; V2 should archive instead. |
| Group client list, collapsible per group, sorted by job date then duration | **KEEP** | Becomes the Jobs-by-group view. |
| Cross-group client search (name/surname, dropdown, click-to-load) | **KEEP** | Naive `Array.filter` over all reports today — fine at current scale, but V2 must use a Dexie index (see §19 of the original spec). |
| Soft-delete ("archive") a client from a group, real permanent delete only from History | **KEEP** | This is exactly the `active/archived` status split requested in the rebuild spec — already validated UX, port the semantics. |
| History section: real archive of every client ever saved, grouped, collapsible, independent of the form's collapse state | **KEEP** | Becomes the default Job list view (filter by status) rather than a bolted-on section. |
| "ყველას წაშლა" (wipe entire report history) | **IMPROVE** | Currently deletes the whole `reports` store with one click (behind a confirm). V2 should not offer a single button that can destroy the whole database; if kept, scope it or remove it in favor of per-record deletion + backup/restore. |
| Field templates (per-field preset lists, add/remove/reorder, picker modal, single-select vs. multi-append fields) | **KEEP** | Exactly the `FieldTemplate` entity requested. Append-fields (`glassPartitionSize`, `installables`) need explicit modeling — see DATA_MODEL.md §6. |
| Template picker modal (in-app, not native `<datalist>`) | **KEEP** | UX pattern is good; rebuild as a proper component, not a hand-rolled `<dialog>`. |
| Custom confirm dialog (`showConfirm`/`window.AppConfirm`) replacing native `confirm()` | **KEEP** | Rebuild as a shared `ConfirmDialog` UI primitive + a `useConfirm()` hook. |
| PDF export (`exportPdf`, popup window + `window.print()`) | **KEEP (deprioritized)** | Currently hidden behind a `hidden` attribute on the button (feature flagged off, logic intact). Real "PDF export" (not print-to-PDF) is a good V2 candidate but not urgent. |
| WhatsApp/image sharing (`html2canvas` rasterizes a card, Web Share API, download+clipboard fallback) | **KEEP** | Valuable, real-world-used feature. Re-implement with the same fallback chain (Web Share → download+clipboard). |
| Google Maps link normalization (raw address or link → guaranteed tappable `https://maps.google.com/...` URL) | **KEEP** | Small but important correctness fix worth preserving as a pure utility function. |
| Bathroom 2D sketch editor (`js/sketch-editor.js`, ~1300 lines, canvas-based) | **REMOVE (for now)** | Mandatory removal per the rebuild spec. Large, self-contained, canvas-heavy — good candidate for a later isolated module, not part of the V2 core rewrite. |
| Service-worker update prompt (custom dialog, `SKIP_WAITING` message) | **KEEP** | Standard PWA pattern, rebuild with the Vite PWA plugin's update hook. |

## 2. Loading mode (`js/loading.js`)

| Feature | Verdict | Notes |
|---|---|---|
| Loading list with 4 fixed categories: trays, glass (+door), panels, extras | **KEEP, generalize** | Spec explicitly asks for extensible categories — model as `LoadingItem.category: string` against a small config table, not 4 hardcoded arrays. |
| Auto-generated ordinal item names ("პირველი", "მეორე", …) | **KEEP** | Small UX nicety, trivial to port. |
| Check/uncheck per item | **KEEP** | |
| Save / load / history (flat list, most-recent-first) | **KEEP** | |
| Per-item delete (with confirm) added on top of "clear all" | **KEEP** | Same "no destructive single button without granular alternative" lesson as report history — already fixed here, keep the pattern. |
| PDF export / WhatsApp image share | **KEEP** | Same `html2canvas` + Web Share pipeline as Report mode — should become one shared service, not two copies. |
| No "duplicate list" feature | **IMPROVE** | Spec asks for duplicate; not present in V1, worth adding in V2. |

## 3. Periods / Workers mode (`js/periods.js`)

Ported in-app from a previously separate project ("EES") into this app's shared
IndexedDB/service worker.

| Feature | Verdict | Notes |
|---|---|---|
| Worker CRUD, multiple stays per worker (entry/exit pairs) | **KEEP** | Maps directly to `Worker` + `Stay` (spec §24). |
| 90/180-day engine: `maxDeparture`, `earliestReturn`, `usedInWindow`, `currentInfo` | **KEEP — port carefully** | Pure date-math functions already; port near-verbatim into `features/periods/domain/*.ts` with unit tests. Uses whole-day UTC arithmetic (`Date.UTC`), not calendar month math — this is correct and must be preserved exactly (verified against real short-month cases in prior conversation). |
| Search, urgency stat ("გასვლა ≤ 14 დღე"), inside/outside status | **KEEP** | |
| Backup/Restore JSON (`{app:"EES", workers:[...]}`) | **KEEP, reframe** | This is exactly a mini version of the "legacy import" concept — treat it as a precedent, not a separate mechanism, in V2. |
| History dialog per worker | **KEEP** | |

## 4. Cross-cutting / infrastructure

| Feature | Verdict | Notes |
|---|---|---|
| Single IndexedDB (`shower-plan-assistant`, currently version 5) shared by all three modes | **KEEP the principle, REBUILD the mechanism** | One DB, repository-per-entity is exactly the V2 direction; raw `indexedDB.open`/manual transactions get replaced by Dexie. |
| Service worker cache-and-precache (`service-worker.js`, versioned cache name bumped by hand every deploy) | **IMPROVE** | Replace hand-maintained `ASSETS` array + manual version bump with `vite-plugin-pwa` (Workbox) generated precaching. |
| Rebrand assets (manifest.json, icons) | **KEEP** | "Plans" branding, blue "P" icon — carry over as-is. |
| `config.js` | **KEEP (trivial)** | Tiny placeholder; re-verify contents before porting (see notes in LEGACY_DATA_AUDIT.md). |

## 5. Server (`server/server.js`, `render.yaml`, `.env.example`)

| Feature | Verdict | Notes |
|---|---|---|
| Express server + static hosting | **REMOVE (for now)** | Mandatory removal per spec. |
| `/api/analyze` — OpenAI-powered BADELIX PDF extraction into the exact Job field shape | **REMOVE (for now), preserve as reference** | Mandatory removal from V2 scope. **Important finding:** this endpoint is fully implemented (structured-output JSON schema matching the legacy report fields, cost/budget tracking, a very detailed extraction prompt) but is **not called from any frontend code** — it is scaffolding, not a live feature. Worth keeping the file as reference documentation for the future AI-import module the user asked about, but it must not block or delay the V2 core rewrite. |
| `/api/health` | **REMOVE (for now)** | Trivial, goes with the rest of the server. |
| Render.com deploy config | **REMOVE (for now)** | Only relevant if/when the server comes back. |

---

## Summary counts

- **KEEP as-is or with light rework:** client/job form, groups, cross-group search,
  active/archived split, history, field templates + picker, confirm dialogs, PDF
  export, WhatsApp/image sharing, Maps-link normalization, loading module (with
  generalized categories), periods/workers module and its 90/180 engine, PWA
  update flow, branding assets.
- **IMPROVE:** "delete everything" history button, loading list duplication
  (missing), service-worker precaching mechanism.
- **REMOVE from V2 scope now (mandatory per spec):** bathroom sketch editor,
  Express server, OpenAI integration, AI PDF analysis. All are self-contained and
  safe to leave out without touching anything else.
