# Ranked

Ranked is a mobile-first college football ballot builder backed by a reusable ranking engine. The launch experience is an AP-style Top 25; the same domain model also renders a stadium ranking to prove that the engine is not team-specific.

## What is included

- Searchable, drag-and-drop Top 25 builder with tap and keyboard alternatives
- Undo/redo, per-draft autosave, and exact-length publish validation
- Published ballot preview and shareable URL
- Contextual record, conference, last-result, and next-opponent data
- Generic entity/template/ranking domain model
- Second "Best Stadiums" template using the same ranking canvas
- Demonstration consensus and demographic cohort filtering with privacy suppression
- Server-only CollegeFootballData adapter with fallback fixtures
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

Never prefix the variable with `NEXT_PUBLIC_`. The browser calls Ranked's own `/api/college-football/teams` route; only the server route reads the secret and sends the upstream Bearer header.

Without a key, the app intentionally remains functional using frozen seed data and labels the dataset as demo data.

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
- `src/app/api`: server-only API boundary
- `src/components`: reusable ranking canvas and product views

The current MVP uses browser storage for an anonymous draft. The next production slice is persisted identity, PostgreSQL rankings/snapshots, and immutable server-side publication.
