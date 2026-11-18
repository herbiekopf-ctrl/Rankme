import { expect, test } from "@playwright/test";
import { teamDataset } from "../fixtures/rankableDatasets";

test("open team results on a shared ballot and return to the same voting week", async ({ page }) => {
  const entity = { ...teamDataset.entities[0], relationalId: "00000000-0000-4000-8000-000000000001" };
  const win = { id: "game-1", opponent: "Beta Tech", date: "2026-11-14T17:00:00Z", completed: true, location: "home", result: "W", scoreLabel: "24–17" };
  const loss = { ...win, id: "game-2", opponent: "Delta College", result: "L", scoreLabel: "17–20", difficultyScore: 0.7 };
  await page.route("**/api/college-football/teams?year=2026", route => route.fulfill({ json: { ...teamDataset, entities: [entity] } }));
  await page.route("**/api/college-football/entity-analytics?**", route => route.fulfill({ json: { entityId: entity.relationalId, season: 2026, games: [win, loss], bestWin: win, worstLoss: loss } }));
  await page.goto("/ballot/2026-response-week-2026-11-16?template=top-25&items=team%3A1");
  const trigger = page.getByRole("button", { name: "View Alpha State team details" });
  await trigger.click();
  const card = page.getByRole("dialog", { name: "Alpha State team details" });
  await expect(card.getByText("Best win")).toBeVisible();
  await expect(card.getByText("Worst loss")).toBeVisible();
  await expect(card.locator(".gamecard-schedule")).toContainText("W 24–17");
  await expect(card.locator(".gamecard-schedule")).toContainText("L 17–20");
  await expect.poll(() => card.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await card.getByRole("button", { name: "Close team details" }).click();
  await expect(trigger).toBeFocused();
  await expect(page.locator(".published-byline")).toHaveText("Week of Nov 16–22 · 2026 season");
});
