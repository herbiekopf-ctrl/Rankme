# Ranking workspace Phase 0 baseline and Phase 1 verification

Date: August 15, 2026  
Repository baseline: `main` at `93643e7`  
Implementation branch: `agent/phase-0-1-ranking-foundations`

## Scope boundary

This packet executes Phases 0 and 1 of the ranking workspace plan. It does not introduce the Phase 2 unified workspace, change the user's ballot from model output, or remove any existing screen.

The existing `RankingBuilder` remains active for this baseline. `NEXT_PUBLIC_RANKING_WORKSPACE_VARIANT` provides an independent rollout and rollback boundary for Phase 2.

## Existing behavior and interaction baseline

| Scenario | Current behavior | Baseline |
| --- | --- | --- |
| New team ranking | Candidate cards and the ballot share the page. Add is local and optimistic. | One explicit add click after a candidate is visible. On mobile the candidate pane is below the ballot. |
| Existing local draft | Reads `ranked:draft:<template-id>`, deduplicates IDs, preserves order, and truncates to the template maximum. | Hydration occurs on mount; later saves are debounced 350 ms. |
| Signed-in custom cloud draft | A local mutation is saved first and then persisted for permanent accounts with a remote template version. | Cloud persistence is asynchronous after the same 350 ms debounce. |
| Stadium custom ranking | Uses the same loader, template builder, ranking component, mutation functions, draft contract, and publish boundary as teams. | The fixture locks it in as the non-team acceptance scenario. |
| Compare to reorder | Compare opens above both panes and selection is separate from the ballot. | At least one compare action, one selection, and one separate move/drag action. |

### 390 px layout baseline

- The 900 px breakpoint turns the desktop grid into one long column: ballot first, candidates second.
- The mobile toolbar is sticky, but the ballot is not persistently accessible once the user scrolls into candidates.
- A ranked row has a 67 px minimum height plus a 7 px list gap. With the pane aligned below the 58 px toolbar, at most about nine compact rows fit in an 844 px viewport before other pane chrome.
- Reorder arrows are hidden below 620 px, leaving drag and remove.
- The comparison matrix has a 520 px minimum width and scrolls horizontally. This remains a Phase 2/5 design seam.

### Persistence and publication contracts

- Draft: template ID/version, dataset version, revision, ordered entity IDs, updated timestamp.
- Ranking mutations remain local and optimistic with undo/redo boundaries.
- Duplicate IDs are removed by insertion and draft hydration.
- Publish remains disabled until template validation succeeds.
- Published output retains the dataset version and explicit user-authored order.
- Metric/model order is not introduced and cannot overwrite the ballot.

## 2026 data baseline and Phase 1 result

The active 2026 dataset was verified across team and non-team entity types. The earlier catalog advertised many stale or non-comparative numeric definitions. Phase 1 now derives the visible catalog from values populated in the selected dataset version and excludes empty or zero-variance metrics.

The reader now scopes definitions to numeric values in the selected dataset version and returns populated count, eligible count, coverage, distinct count, availability, and comparative state. The application recalculates those values after filtering and removes metrics with no values or fewer than two distinct values.

Preseason `wins`, `losses`, and `gamesPlayed` are populated but have one distinct value, so they are excluded until useful.

### Curated configuration

- Team Core: FPI, SP+ overall/offense/defense, SOS when populated, talent/recruiting, AP rank, record/scoring when comparative, and returning production.
- Stadium Core: capacity, construction year, and elevation. Location, team, surface, and dome remain context rather than invented scores.
- Player Core: class year, height, and weight until legitimate production data exists.
- Town Core: team count only when comparative; state and schools remain context. No town-quality score is invented.
- Lower-is-better directions and formats are corrected for rank, losses, and defensive/ranking measures.

## Media audit and repair

- Team marks resolve as canonical media; reused team logos resolve as related-team context.
- Missing/broken media uses stable initials and color fallback.
- Logo images use fixed square bounds and `object-fit: contain`.
- Active team logo URLs were checked against canonical team IDs.
- External-ID uniqueness changed from global `(source_slug, external_id)` to `(entity_id, source_slug)` because CFBD IDs collide across resource types.
- Active teams now have matching CFBD external-ID rows.

## Performance baseline

Query plans were measured against the active 2026 dataset. Version-scoped aggregation and the partial numeric index materially reduced warm catalog-read time. Large player datasets remain an explicit virtualization target for a later phase.

## Automated safety rails

- Unit coverage includes metric curation, zero-variance suppression, non-team catalogs, media semantics, canonical logo-ID checks, fallbacks, Supabase receipt parsing, and the workspace flag.
- Playwright fixtures cover 2026 teams and stadiums.
- Browser scenarios cover add/move/remove, undo/redo, local draft hydration, persistence, publish enablement, 390 px overflow, stadium sorting, and media behavior.
- The sandbox could not download Chromium, so browser execution must run in CI or a workstation with Playwright browsers installed.

## Database verification

- Reader permissions and search-path behavior were rechecked after migration.
- The corrected external-ID constraint and lookup index are present.
- The database advisor pass reported no new migration-caused issue.
