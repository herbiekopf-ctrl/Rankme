import { describe, expect, it } from "vitest";
import { parseSupabaseRankableDatasetReceipt } from "./supabaseRankables";

function receipt(entityType: string, entities: unknown[], metrics: unknown[]) {
  return {
    datasetVersionId: "version-2026",
    versionKey: "cfbd-2026-test",
    fetchedAt: "2026-08-15T00:00:00.000Z",
    sourceRequestCount: 19,
    sourceMetadata: { warnings: [] },
    entityType,
    entities,
    metrics,
  };
}

function rawMetric(key: string, label = key) {
  return { key, label, unit: "decimal", direction: "desc", metricGroup: "Other", populatedEntityCount: 999, eligibleEntityCount: 999 };
}

describe("Supabase rankable dataset receipt", () => {
  it("defensively removes historic definitions and recalculates availability from team values", () => {
    const data = receipt("team", [
      { canonicalKey: "team:1", name: "Alpha", attributes: { fpi: 15.5, wins: 0 } },
      { canonicalKey: "team:2", name: "Beta", attributes: { fpi: 7.2, wins: 0 } },
    ], [rawMetric("fpi"), rawMetric("wins"), rawMetric("advanced:offense:passingDowns:explosiveness")]);

    const parsed = parseSupabaseRankableDatasetReceipt(data, "teams");

    expect(parsed?.metricDefinitions?.map((metric) => metric.key)).toEqual(["fpi"]);
    expect(parsed?.metricDefinitions?.[0]).toMatchObject({ populatedEntityCount: 2, eligibleEntityCount: 2, distinctValueCount: 2, tier: "core" });
  });

  it("uses the same generic parser for a non-team ranking", () => {
    const data = receipt("stadium", [
      { canonicalKey: "stadium:1", name: "Alpha Field", attributes: { capacity: 80000, dome: false } },
      { canonicalKey: "stadium:2", name: "Beta Field", attributes: { capacity: 60000, dome: true } },
    ], [rawMetric("capacity"), rawMetric("teamCount")]);

    const parsed = parseSupabaseRankableDatasetReceipt(data, "stadiums");

    expect(parsed?.metricDefinitions?.map((metric) => metric.key)).toEqual(["capacity"]);
    expect(parsed?.metricDefinitions?.[0]).toMatchObject({ entityType: "stadium", label: "Capacity", tier: "core" });
  });
});
