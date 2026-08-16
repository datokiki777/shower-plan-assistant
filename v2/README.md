# Plans V2

React + TypeScript + Vite rebuild of `shower-plan-assistant`. See the
planning documents at the repository root (`ARCHITECTURE.md`,
`DATA_MODEL.md`, `MIGRATION_PLAN.md`, `OLD_APP_FEATURE_AUDIT.md`,
`LEGACY_DATA_AUDIT.md`) for the full plan this implementation follows.

## Run/preview V2 separately from V1 (safe, no cutover)

V2 lives entirely in this `v2/` subfolder with its own `package.json` and
Vite config. V1 (repo root - `index.html`, `js/`, etc., no build step) is
completely untouched by anything below; nothing here writes to the repo
root, `main`, or any production URL.

```
cd v2
npm install
npm run dev       # local dev server, e.g. http://localhost:5173 - separate port, separate IndexedDB database (shower-plan-assistant-v2)
```

For a production-like static preview (closer to what an eventual real
deploy would serve):

```
npm run build      # outputs to v2/dist/
npm run preview    # serves that build locally, e.g. http://localhost:4173
```

Either way V2 opens at its own local URL, never at V1's production domain,
and reads/writes only its own IndexedDB database
(`shower-plan-assistant-v2`) - V1's database and production site are never
touched. This is the simplest safe way to test V2 (including a real V1
data import via Settings → Data) before any cutover decision.

## Scripts

```
npm run dev         # start the dev server
npm run typecheck   # tsc -b --noEmit
npm run lint        # oxlint
npm run test        # vitest run
npm run build       # tsc -b && vite build
```

## Database

Uses its own IndexedDB database, `shower-plan-assistant-v2` - completely
separate from V1's `shower-plan-assistant` database. V1 data is never read
or written by this app directly; migration happens only via the JSON export
produced by V1's "Export data for V2" feature (see `MIGRATION_PLAN.md`).
