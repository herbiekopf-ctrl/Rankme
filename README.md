# Ranked

Ranked is a mobile-first college football ballot builder backed by a reusable ranking engine. The launch experience is an AP-style Top 25; the same domain model also renders a stadium ranking to prove that the engine is not team-specific.

## What is included

- Searchable, drag-and-drop Top 25 builder with tap and keyboard alternatives
- Undo/redo, per-draft autosave, and exact-length publish validation
- Published ballot preview and shareable URL
- Contextual records, results, power ratings, production, efficiency, recruiting, talent, and roster metrics
- Generic in-workflow comparisons and sortable metric leaderboards for every data-backed entity type
- Canonical poll creator for teams, players, coaches, conferences, games, stadiums, towns, mascots, recruiting classes, recruits, transfers, units, team seasons, and draft picks
- Unlimited user-written ranking questions with database-backed eligibility pools; typed or pasted answer choices are deliberately rejected
- Generic entity/template/ranking domain model
- Second "Best Stadiums" template using the same ranking canvas
- Relational cross-poll affinity explorer and demographic cohort filtering with a hard 25-person privacy floor
- Optional consented preference profiles using coarse region, age band, and football-experience categories
- Open browsing and local drafts, with permanent email-link accounts required only to publish or contribute to consensus/demographics
- Server-only CollegeFootballData adapter with a 26-dataset shared weekly snapshot and independent optional-feed failures
- Supabase PostgreSQL schema for entities, relationships, metrics, templates, rankings, placements, demographics, groups, aggregates, snapshots, and ingestion jobs
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

Add the Supabase project settings through `.env.local`, GitHub Codespaces secrets, and your deployment environment:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

The URL and publishable key identify the app to Supabase. `SUPABASE_SECRET_KEY` is server-only and must never be exposed in a `NEXT_PUBLIC_` variable, committed file, browser bundle, or chat message. The legacy `SUPABASE_SERVICE_ROLE_KEY` name is supported as a fallback.

In the Supabase dashboard, keep **Authentication → Providers → Anonymous Sign-Ins** disabled. Configure both the **Confirm signup** and **Magic Link** email templates to show `{{ .Token }}` instead of `{{ .ConfirmationURL }}`. Ranked verifies that one-time email code in the browser so a local draft never has to leave the page during sign-in. Database functions and RLS reject anonymous publication even if a client bypasses the UI.

Without a key, the app intentionally remains functional using frozen seed data and labels the dataset as demo data.

After starting the app, open `/api/college-football/status?year=2025`, then repeat with `year=2026`. A working CFBD secret returns `"status":"connected"`, `"usingCfbdSnapshot":true`, the snapshot version, refresh time, and entity count. Open `/api/platform/status` to verify that Supabase is reachable, its migration is ready, the server write secret is configured, and the active relational dataset exists. Neither endpoint returns a credential.

## Data refresh model

The first server request after the weekly refresh window requests 26 CFBD datasets in parallel. The import covers teams, records, games, rosters, coaches, venues, team/player season statistics, advanced efficiency, Elo, SRS, SP, FPI, PPA, official polls, recruiting classes and recruits, talent, returning production, transfer portal entries, player usage/success, opponent-adjusted metrics, and NFL draft picks. Ranked transforms them into one coherent versioned snapshot with canonical entities, relationships, and a dynamically discovered metric catalog. Odds are intentionally excluded as rankable entities. Every ranking and comparison after that reads the shared snapshot and makes zero per-user CFBD requests.

- Default refresh window: 7 days (`CFBD_REFRESH_SECONDS=604800`)
- Default local snapshot: `.data/college-football-2026.json` (ignored by git)
- Optional persistent directory: `CFBD_SNAPSHOT_DIR=/mounted/path`
- Production system of record: Supabase PostgreSQL, written by the server-only ingestion client
- Scheduled refresh: `.github/workflows/refresh-ranked-data.yml` calls the protected `/api/admin/refresh` endpoint every Monday at 08:17 UTC after deployment
- Serverless/local fallback: Next.js cache, memory, and `.data` keep the UI usable when database persistence is not configured

Only teams, records, and games are required to publish a snapshot. Every richer feed is independent: if coaches, roster, advanced stats, or a paid metric is unavailable, Ranked records a warning and preserves the other datasets.

For automatic refreshes, set a long random `RANKED_INGEST_TOKEN` in the deployment environment and add `RANKED_APP_URL` plus the matching `RANKED_INGEST_TOKEN` as GitHub Actions secrets. The endpoint uses constant-time token comparison, accepts only `POST`, and never returns a credential. Until the app has an always-on deployment URL, use the two initial status requests from the setup section.

## Supabase migrations

Tracked migrations live in `supabase/migrations`. The foundation creates 29 RLS-enabled tables, 18 entity types (14 currently rankable), coarse demographic taxonomies, canonical source mappings, append-only ranking events, cohort consensus, cross-poll affinity, and transactional community-poll/ballot functions. Aggregate functions are server-only and return no placement or demographic detail below the 25-person threshold. Canonical option pools and permanent-account checks are enforced in PostgreSQL, not only in React.

`/api/insights/catalog` discovers public relational polls. `/api/insights/affinity` executes the real server-only affinity function and returns either a privacy-cleared aggregate or a suppressed result with no sample size or placements.

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

When Supabase is configured, community polls, draft rankings, placements, published ballots, consented cohort values, snapshots, entities, metrics, and relationships are persisted in PostgreSQL. Browser storage remains a resilient offline/local draft fallback. Shared links still carry enough context to render a receipt, while aggregate-eligible public ballots use the immutable relational publication record.
