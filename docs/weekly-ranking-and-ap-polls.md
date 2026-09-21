# Weekly ranking and AP viewing

## User experience

- Rankings starts with a read-only community Top 25. AP Poll & Voters is a separate view (`/rankings?view=ap`). Demographic filters are optional, with the existing privacy rules unchanged.
- My Top 25 opens the editor. Search/add, drag or rank-number selection, undo, and Review & Submit are the primary controls. Stats and Live Model stay behind Need Help on both phone and desktop.
- New Top 25 ballots may start with a verified, same-season AP order when all 25 source teams map uniquely to eligible entities. This never replaces a nonempty draft.
- A saved draft is not a vote. Published revisions require explicit Save Update.

## Period semantics

Ranked retains the existing database's Monday 00:00 to next Monday 00:00 America/New_York window. This release does not redefine already-published cycles. The UI displays the actual date range and closing timestamp, not the database's ISO week number as a football week.

AP source weeks describe completed-game weeks. They are presented as “After Week N” together with the release date, not as the community voting window. Preseason and final polls retain those labels.

Weekly local drafts are scoped by account, template, and period; signing in can recover the current guest draft if no account draft exists. Old unscoped local keys remain untouched. On an expired tab, editing is locked and the user must reload into a fresh week. The submission path rechecks the server's active period before saving/publishing. Database RPCs continue enforcing ownership, one vote per person, open periods, and revision history.

History uses three consecutive calendar windows, including empty weeks. It never substitutes an old voted-on cycle for the current week. Football season defaults roll in July and remain on the prior season through the postseason; custom polls retain their configured year.

## AP source and integrity

`GET /api/ap-poll` reads the latest public College Poll Tracker football list and matching ballot grid server-side, with hourly cache revalidation. Source URLs are fixed/allowlisted; no arbitrary caller-provided URL is fetched. The UI credits and links the source, and team logos use the existing same-origin Next.js image pipeline.

The parser requires matching release dates, 25 unique choices per submitted voter, unique voter IDs, and exact agreement between reconstructed Borda points/first-place counts and published totals for every receiving-votes team. Entirely blank non-voter rows are excluded. Missing or inconsistent ballots are withheld; the aggregate may still display with a clear unavailable message. Upstream failure yields an explicit retry state, never manufactured rankings.

The adapter depends on public HTML structure, so monitor parser failures if the source changes. No AP API key or database migration is required. The AP route is independent of community database availability.

## Validation and operational blocker

Unit coverage includes Eastern midnight, DST, year transitions, empty voting weeks, and incomplete/mismatched AP ballots. Browser tests cover 390px and desktop viewing, direct ranking controls, local persistence, optional metrics/Live Model, and an open tab crossing its weekly deadline. Browser fixtures are synthetic and test-only; the live AP endpoint was separately verified against 68 submitted ballots on the September 13, 2026 release.

On September 20, 2026, the configured Ranked Supabase project `syewrwttjfgdsluzxazh` was INACTIVE and production `/api/platform/status` returned `schemaReady: false`. Resume that existing project, then verify sign-in, current-season data, draft save, publish, revision, and consensus against live storage before calling production healthy. Do not treat this frontend update as a database restoration.
