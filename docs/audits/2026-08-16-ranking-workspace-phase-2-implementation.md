# Ranking Workspace Phase 2 Implementation

Date: 2026-08-16

## Outcome

Phase 2 replaces the page-like ranking flow with a unified, reusable workspace shell. The user's ordered ranking and the analysis/candidate surface are now visually distinct while remaining in the same working context.

The existing builder remains available as an explicit rollback by setting:

```env
NEXT_PUBLIC_RANKING_WORKSPACE_VARIANT=classic
```

The unified workspace is the default.

## Architecture

- `useRankingWorkspace` owns draft hydration, ranking mutations, debounced local/cloud persistence, comparison selection, details, and publishing.
- `rankingHistoryReducer` provides bounded undo/redo history and deduplicated draft hydration.
- `RankingWorkspace` composes reusable `WorkspaceHeader`, `RankingPane`, `AnalysisPane`, `EntityDetailSheet`, `PublishDialog`, and `MobileRankingTray` components.
- `ClassicRankingBuilder` preserves the Phase 0–1 behavior for rollback without duplicating routes or backend systems.

## Desktop behavior

- Persistent two-pane `Ranking | Analyze / Compare` layout.
- Independent pane scrolling keeps the ballot visible while candidates or comparison data are explored.
- Explicit pane headings and treatment make ranking state distinct from decision-support data.
- Candidate search, entity filters, metric ordering, contextual details, and comparison remain inside the workspace.

## Mobile behavior

- Purpose-built single-pane states at 390px rather than a shrunken desktop grid.
- A persistent bottom tray exposes `YOUR RANKING` and `ANALYZE` with live counts.
- Both panes remain mounted, so switching modes preserves each pane's scroll and interaction state.
- Ranking rows, controls, spacing, and typography are compacted to show more ballot content.
- Touch scrolling is restored on ranked rows while the dedicated drag handle retains touch drag behavior.

## Preserved behavior

- Pointer, keyboard, and touch-handle drag and drop.
- Add, remove, move, undo, and redo.
- Local draft hydration and 350ms debounced autosave.
- Authenticated relational draft persistence and publication.
- Share preview generation.
- Generic entity rendering; the same workspace code handles team and stadium fixtures.

## Verification

- `vitest run`: 26 tests passed across 10 files.
- `tsc --noEmit`: passed.
- `eslint . --max-warnings=0`: passed.
- `next build`: passed; all 14 routes generated or compiled successfully.
- Production server smoke check: `/` and `/rank/top-25` returned HTTP 200; the ranking response contains both `YOUR RANKING` and `ANALYZE / COMPARE` landmarks.
- Playwright: all 8 desktop/mobile cases are discovered. Execution is blocked in this runner because the Chromium binary is not installed; no application assertion ran or failed.

## Phase boundary

Phase 2 establishes the unified workspace, responsive pane model, and shared interaction controller. Live metric header sorting, heat mapping, live weighting, and custom metric creation remain later phases and are intentionally not implemented here.
