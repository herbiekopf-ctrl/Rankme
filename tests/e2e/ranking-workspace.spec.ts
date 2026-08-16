import { expect, test, type Page } from "@playwright/test";
import { stadiumDataset, stadiumPollConfig, teamDataset, teamPollConfig } from "../fixtures/rankableDatasets";
import type { CustomPollConfig, DatasetEnvelope, RankingDraft } from "../../src/lib/domain/types";

async function openFixtureRanking(page: Page, config: CustomPollConfig, dataset: DatasetEnvelope, draft?: Partial<RankingDraft>) {
  await page.addInitScript(({ configValue, draftValue }) => {
    window.localStorage.setItem(`ranked:custom-poll:${configValue.id}`, JSON.stringify(configValue));
    if (draftValue) window.localStorage.setItem(`ranked:draft:custom-${configValue.id}`, JSON.stringify(draftValue));
  }, { configValue: config, draftValue: draft });
  await page.route("**/api/college-football/rankables?**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(dataset) });
  });
  await page.route("https://cdn.collegefootballdata.com/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") });
  });
  await page.goto(`/rank/custom/${config.id}`);
  await expect(page.getByRole("heading", { name: config.title })).toBeVisible();
}

test("characterizes add, move, remove, undo, redo, local draft, and publish boundaries", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop interaction baseline");
  await openFixtureRanking(page, teamPollConfig, teamDataset);

  const rankingPane = page.locator('[data-workspace-pane="ranking"]');
  const analysisPane = page.locator('[data-workspace-pane="analysis"]');
  const publish = page.getByRole("button", { name: "Publish my ranking" });
  await expect(rankingPane.getByText("YOUR RANKING", { exact: true })).toBeVisible();
  await expect(analysisPane.getByText("ANALYZE / COMPARE", { exact: true })).toBeVisible();
  await expect.poll(async () => {
    const rankingBox = await rankingPane.boundingBox();
    const analysisBox = await analysisPane.boundingBox();
    return Boolean(rankingBox && analysisBox && rankingBox.x < analysisBox.x);
  }).toBe(true);
  await expect(page.locator('[data-media-role="canonical-team-mark"] img')).toHaveCSS("object-fit", "contain");
  await expect(page.locator('[data-media-role="fallback"]').first()).toBeVisible();
  await expect(publish).toBeDisabled();
  await page.getByRole("button", { name: "Add Alpha State" }).click();
  await page.getByRole("button", { name: "Add Beta Tech" }).click();
  await expect(page.getByRole("heading", { name: "2 of 3 ranked" })).toBeVisible();
  await page.getByRole("button", { name: "Move Beta Tech up" }).click();
  await expect(page.locator(".ranked-name-button strong")).toHaveText(["Beta Tech", "Alpha State"]);
  await page.getByRole("button", { name: /Undo/ }).click();
  await expect(page.locator(".ranked-name-button strong")).toHaveText(["Alpha State", "Beta Tech"]);
  await page.getByRole("button", { name: /Redo/ }).click();
  await expect(page.locator(".ranked-name-button strong")).toHaveText(["Beta Tech", "Alpha State"]);
  await page.getByRole("button", { name: "Remove Alpha State" }).click();
  await expect(page.getByRole("button", { name: "Add Alpha State" })).toBeVisible();
  await page.getByRole("button", { name: /Undo/ }).click();
  await page.getByRole("button", { name: "Add Gamma University" }).click();
  await expect(publish).toBeEnabled();

  await expect.poll(async () => page.evaluate(() => {
    const raw = window.localStorage.getItem("ranked:draft:custom-phase0-team");
    return raw ? (JSON.parse(raw) as RankingDraft).entityIds : [];
  })).toEqual(["team:2", "team:1", "team:3"]);
});

test("keeps comparison inside analysis while the ranking remains visible", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop unified workspace baseline");
  await openFixtureRanking(page, teamPollConfig, teamDataset);

  await page.getByRole("button", { name: "Compare Alpha State" }).click();
  const analysisPane = page.locator('[data-workspace-pane="analysis"]');
  await expect(analysisPane.getByRole("heading", { name: "Compare any teams in this ranking." })).toBeVisible();
  await expect(page.locator('[data-workspace-pane="ranking"]')).toBeVisible();
  await analysisPane.getByLabel("Beta Tech").check();
  await expect(analysisPane.getByRole("button", { name: "Alpha State" })).toBeVisible();
  await expect(analysisPane.getByRole("button", { name: "Beta Tech" })).toBeVisible();
  await expect(analysisPane.getByText("2 selected · no limit")).toBeVisible();
});

test("hydrates an existing local draft without changing its saved order", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop draft baseline");
  await openFixtureRanking(page, teamPollConfig, teamDataset, {
    id: "local-custom-phase0-team",
    templateId: "custom-phase0-team",
    templateVersion: 1,
    datasetVersion: teamDataset.version,
    revision: 4,
    entityIds: ["team:3", "team:1"],
    updatedAt: "2026-08-15T23:00:00.000Z",
  });
  await expect(page.locator(".ranked-name-button strong")).toHaveText(["Gamma University", "Alpha State"]);
  await expect(page.getByRole("heading", { name: "2 of 3 ranked" })).toBeVisible();
});

test("keeps the generic stadium workflow usable at 390px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "390px mobile baseline");
  await openFixtureRanking(page, stadiumPollConfig, stadiumDataset);
  await page.getByRole("button", { name: /^ANALYZE/ }).last().click();
  await page.getByRole("button", { name: "Add Alpha Field" }).scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Add Alpha Field" }).click();
  await expect(page.getByRole("button", { name: /^YOUR RANKING/ }).last()).toContainText("1/2");
  await page.getByRole("button", { name: /^YOUR RANKING/ }).last().click();
  await expect(page.getByRole("heading", { name: "1 of 2 ranked" })).toBeVisible();
  await expect(page.locator('[data-media-role="related-team-mark"]').first()).toBeVisible();
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: /^ANALYZE/ }).last().click();
  await page.getByLabel("Sort candidates").selectOption("capacity");
  await expect(page.locator(".candidate-identity > strong")).toHaveText(["Beta Stadium", "Gamma Dome"]);
  const analysisScroll = page.locator('[data-scroll-region="analysis"]');
  await page.locator(".rw-candidate-list").evaluate((element) => { element.setAttribute("style", "padding-bottom: 900px"); });
  await analysisScroll.evaluate((element) => { element.scrollTop = 120; });
  await page.getByRole("button", { name: /^YOUR RANKING/ }).last().click();
  await page.getByRole("button", { name: /^ANALYZE/ }).last().click();
  await expect.poll(() => analysisScroll.evaluate((element) => element.scrollTop)).toBe(120);
});
