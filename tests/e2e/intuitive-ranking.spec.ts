import { expect, test } from "@playwright/test";
import { teamDataset, teamPollConfig } from "../fixtures/rankableDatasets";

test("AP viewing is read-only and each voter has one complete ballot", async ({ page }, testInfo) => {
  const teams = Array.from({ length: 25 }, (_, i) => ({ id: `t${i}`, name: `Test University ${i + 1}`, rank: i + 1, points: 25 - i, firstPlaceVotes: i === 0 ? 1 : 0, imageUrl: "" }));
  await page.route("**/api/ap-poll", route => route.fulfill({ json: {
    season: 2026, week: "Week 2", releasedAt: "2026-09-13T12:00:00Z", fetchedAt: "2026-09-19T12:00:00Z",
    sourceUrl: "https://collegepolltracker.com/football/2026/week-2", teams, ballotsVerified: true,
    ballots: [{ id: "test-voter", name: "Test Voter", affiliation: "Test Newspaper", teamIds: teams.map(t => t.id).reverse() }],
  } }));
  await page.goto("/rankings?view=ap");
  await expect(page.getByRole("heading", { name: "AP Top 25" })).toBeVisible();
  await expect(page.getByText("After Week 2 · Released September 13, 2026")).toBeVisible();
  await expect(page.locator(".ap-ranking-list > li")).toHaveCount(25);
  await page.getByLabel("View the poll or an individual vote").selectOption("test-voter");
  await expect(page.getByRole("heading", { name: "Test Voter" })).toBeVisible();
  await expect(page.locator(".ap-ranking-list > li").first()).toContainText("Test University 25");
  await expect(page.getByRole("button", { name: /Move .* up/ })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("ap-voter.png"), fullPage: true });
});

test("rank without opening analysis; reorder, undo, and review the voting period", async ({ page }, testInfo) => {
  await page.addInitScript(config => localStorage.setItem(`ranked:custom-poll:${config.id}`, JSON.stringify(config)), teamPollConfig);
  await page.route("**/api/college-football/rankables?**", route => route.fulfill({ json: teamDataset }));
  await page.goto(`/rank/custom/${teamPollConfig.id}`);
  const picker = page.locator(".quick-team-picker");
  const ranking = page.locator('[data-workspace-pane="ranking"]');
  await expect(picker).toBeVisible();
  await expect(page.locator('[data-workspace-pane="analysis"]')).not.toBeVisible();
  for (const name of ["Alpha", "Beta", "Gamma"]) {
    await page.getByRole("searchbox").fill(name);
    await picker.getByRole("button", { name: "+ Add", exact: true }).click();
  }
  await ranking.getByLabel("Move Gamma University to rank", { exact: true }).selectOption("1");
  await expect(page.locator(".ranked-name-button strong")).toHaveText(["Gamma University", "Alpha State", "Beta Tech"]);
  await page.getByRole("button", { name: /Undo/ }).click();
  await expect(page.locator(".ranked-name-button strong")).toHaveText(["Alpha State", "Beta Tech", "Gamma University"]);
  await expect(page.locator(".draft-status")).toContainText("Not submitted");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("simple-ballot.png"), fullPage: true });
  await page.getByRole("button", { name: "Review & Submit" }).click();
  await expect(page.locator(".publish-period")).toContainText("One-time poll · 2026");
});

test("an open tab stops accepting edits when its weekly deadline passes", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-21T03:59:00Z") });
  const config = { ...teamPollConfig, responseCadence: "weekly" };
  await page.addInitScript(value => localStorage.setItem(`ranked:custom-poll:${value.id}`, JSON.stringify(value)), config);
  await page.route("**/api/college-football/rankables?**", route => route.fulfill({ json: teamDataset }));
  await page.goto(`/rank/custom/${config.id}`);
  await expect(page.locator(".rw-period-identity")).toContainText("Week of Sep 14–20");
  await page.getByRole("searchbox").fill("Alpha");
  await page.locator(".quick-team-picker").getByRole("button", { name: "+ Add", exact: true }).click();
  await page.clock.fastForward(90_000);
  await expect(page.getByRole("button", { name: "Open the current week" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review & Submit" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Remove Alpha State" })).toBeDisabled();
  await page.reload();
  await expect(page.locator(".rw-period-identity")).toContainText("Week of Sep 21–27");
  await expect(page.locator(".ranked-name-button strong")).toHaveCount(0);
});
