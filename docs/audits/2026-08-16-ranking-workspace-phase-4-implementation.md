# Ranking Workspace Phase 4 Implementation

Date: 2026-08-16

## Outcome

Phase 4 refines the existing unified ranking workspace around a phone-first decision loop: see, compare, understand, add or move, and continue ranking without losing context. It preserves the desktop Live Model and ranking persistence architecture.

## Audit findings

- The desktop Live Model had a useful three-pane structure, but its narrow layout stacked too much content without a clear input/results state.
- Heat treatment did not consistently expose ordinal rank or account for lower-is-better metrics.
- Comparison still relied on a wide table and a small fixed selection workflow.
- Candidate sorting, comparison, model results, and entity details did not share a single add-or-focus ranking action.
- Poll filters were rediscovered from the already-filtered result, which caused Conference and similar controls to disappear after selection.
- Conference entities had no stored image URLs in the active catalog, despite canonical conference identities being present.
- The existing affiliation table already supported canonical team and conference IDs with private per-user policies.
- Personal trend history existed, while community trend data needed a separately labeled aggregation path.
- The 2026 catalog and a populated 2025 version were both available; prior-season context needed a deliberate metric allowlist.
- Team schedule cards queried an obsolete dataset slug and could appear empty even though the active 2026 version contains game data.

## Implementation

- Mobile Live Model uses compact `Model inputs | Results` states, vertical weight controls, a persistent mini-ranking, and dense result rows.
- Model and metric results show `My rank`, calculated rank, movement, raw value, ordinal position, and an accessible strength label.
- Shared heat logic normalizes within the eligible set and respects each metric's `asc` or `desc` direction.
- Comparison accepts any number of selected entities. Desktop retains the rich matrix; mobile uses stacked cards without a wide table.
- Candidate lists, comparison, Live Model, and entity details use the same `+ Rank` or current-position action. Current positions focus and highlight the corresponding ballot row.
- Metric definitions now supply reusable explanations, direction, units, source, and seasonal context through a compact info control.
- Ranking creation preserves discovered filter definitions so selected fields remain visible, editable, and clearable.
- Conference media resolves through one canonical mapping with a consistent fallback and an explicitly allowed image host.
- A narrow prior-season allowlist adds clearly labeled 2025 context during the 2026 preseason and first two games, without changing canonical current-season values.
- Optional Favorite Team and Conference Affiliation fields save canonical entity IDs through the existing private affiliation model.
- Trends has an explicit `My Rankings | All Voters` perspective and never combines the two series ambiguously.
- Team detail schedule lookup now resolves the published version by season and excludes games outside that version.
- Consumer-facing copy removes storage, database, and internal architecture terminology.

## Data checks

- Active catalog: 138 teams and 11 conferences.
- Canonical conference mapping covers all active conference names.
- Published 2026 version: 888 game entities with saved values.
- A live team relationship check returned 12 current-season games for the sampled team.
- Existing row-level policies keep individual affiliations private while allowing future privacy-cleared aggregate analysis.

## Verification

- ESLint: passed with zero warnings.
- Vitest: 42 tests passed across 16 files.
- Production webpack compilation: passed.
- Source type checking reaches only the runner's missing `@playwright/test` package; the dependency is already pinned in `package.json` and the lockfile.
- Playwright coverage now includes 390 px Live Model density and stacked heat-map comparison. Local browser execution remains blocked because this runner does not contain the declared Playwright package or a browser binary.
- Diff whitespace check: passed.

## Architecture boundary

No new ranking page, metric engine, persistence system, or database migration was introduced. The classic workspace remains an explicit rollback path, and the unified workspace remains the default.
