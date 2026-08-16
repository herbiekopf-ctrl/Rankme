import { describe, expect, it } from "vitest";
import { entityRankSeries, trendEntities, type RankingTrendList } from "./rankingTrends";

const list: RankingTrendList = {
  templateVersionId: "version",
  templateId: "template",
  title: "Top teams",
  slug: "top-teams",
  entityType: "team",
  responseCadence: "weekly",
  maxLength: 25,
  snapshots: [
    { rankingId: "r1", cycleId: "c1", periodSlug: "w1", periodTitle: "Week 1", periodAt: "2026-08-03", publishedAt: "2026-08-03", placements: [{ entityId: "a", canonicalKey: "a", name: "Alpha", imageUrl: null, color: null, position: 4 }] },
    { rankingId: "r2", cycleId: "c2", periodSlug: "w2", periodTitle: "Week 2", periodAt: "2026-08-10", publishedAt: "2026-08-10", placements: [{ entityId: "a", canonicalKey: "a", name: "Alpha", imageUrl: null, color: null, position: 2 }, { entityId: "b", canonicalKey: "b", name: "Beta", imageUrl: null, color: null, position: 8 }] },
  ],
};

describe("ranking trends", () => {
  it("builds rank history with gaps when an entity was unranked", () => {
    expect(entityRankSeries(list, "a")).toEqual([4, 2]);
    expect(entityRankSeries(list, "b")).toEqual([null, 8]);
  });

  it("exposes each comparable entity once", () => {
    expect(trendEntities(list).map((entity) => entity.name)).toEqual(["Alpha", "Beta"]);
  });
});
