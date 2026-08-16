# Plans V2 (foundation)

React + TypeScript + Vite rebuild of `shower-plan-assistant`. See the
planning documents at the repository root (`ARCHITECTURE.md`,
`DATA_MODEL.md`, `MIGRATION_PLAN.md`, `OLD_APP_FEATURE_AUDIT.md`,
`LEGACY_DATA_AUDIT.md`) for the full plan this implementation follows.

This is **Phase 2: technical foundation only** - no business features yet.
See those root docs for what's already decided and why.

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
