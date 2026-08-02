# Ranked

Ranked is a mobile-first college football ballot builder backed by a reusable ranking engine. The launch experience is an AP-style Top 25; the same domain model also renders a stadium ranking to prove that the engine is not team-specific.

## What is included

- Searchable, drag-and-drop Top 25 builder with tap and keyboard alternatives
- Undo/redo, per-draft autosave, and exact-length publish validation
- Published ballot preview and shareable URL
- Contextual record, conference, last-result, next-opponent, and six comparison metrics
- In-workflow team comparison and sortable metric leaderboards
- Custom poll creator for FBS teams, conference schools, mascots, towns, stadiums, players by position, and pasted option lists
- Generic entity/template/ranking domain model
- Second "Best Stadiums" template using the same ranking canvas
- Demonstration consensus and demographic cohort filtering with privacy suppression
- Server-only CollegeFootballData adapter with a shared weekly snapshot and fallback fixtures
- Domain, consensus, and adapter tests

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Add your CollegeFootballData key only to `.env.local`:

```dotenv
CFBD_API_KEY=your_key_here
```

Never prefix the variable with `NEXT_PUBLIC_`. The browser calls Ranked's own API routes; only the server adapter reads the secret and sends the upstream Bearer header.

Without a key, the app intentionally remains functional using frozen seed data and labels the dataset as demo data.

After starting the app, open `/api/college-football/status?year=2026`. A working secret returns `"status":"connected"`, `"usingCfbdSnapshot":true`, the snapshot version, refresh time, and entity count. The endpoint never returns the credential.

## Data refresh model

The first server request after the weekly refresh window makes four upstream CFBD requests in parallel: FBS teams, records, games, and rosters. Ranked transforms those responses into one versioned snapshot containing teams, players, mascots, towns, stadiums, and comparison metrics. Every ranking and comparison after that reads the saved snapshot and makes zero per-user CFBD requests.

- Default refresh window: 7 days (`CFBD_REFRESH_SECONDS=604800`)
- Default local snapshot: `.data/college-football-2026.json` (ignored by git)
- Optional persistent directory: `CFBD_SNAPSHOT_DIR=/mounted/path`
- Serverless fallback: Next.js caches the four upstream responses for the same refresh window when the runtime filesystem is not writable

If the roster endpoint is unavailable, the team snapshot still succeeds and the UI labels player polls unavailable instead of dropping all CFBD data.

## Checks

```bash
npm run test
npm run lint
npm run typecheck
npm run build
```

## Architecture

- `src/lib/domain`: generic entities, templates, ranking operations, consensus rules
- `src/lib/adapters`: replaceable source adapters and transformations
- `src/app/api`: server-only dataset, catalog, rankable-list, and health boundaries
- `src/components`: reusable ranking canvas and product views

The current MVP uses browser storage for anonymous drafts and custom-poll definitions. Shared links carry the poll definition and ordered entity IDs. The next production slice is persisted identity, PostgreSQL rankings/snapshots, and immutable server-side publication.
