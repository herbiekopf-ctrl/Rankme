import { describe, expect, it } from "vitest";
import { calculateCustomMetricScores, metricDesirability, metricHeatPresentation, rankDifference } from "./metrics";
import type { CustomMetricFormula, MetricDefinition, RankableEntity } from "./types";

const definitions: MetricDefinition[] = [
  { key: "offense", label: "Offense", description: "", format: "decimal", direction: "desc" },
  { key: "pointsAllowed", label: "Points allowed", description: "", format: "decimal", direction: "asc" },
];

const entities: RankableEntity[] = [
  { id: "a", entityType: "team", name: "A", attributes: { offense: 30, pointsAllowed: 10 } },
  { id: "b", entityType: "team", name: "B", attributes: { offense: 20, pointsAllowed: 20 } },
  { id: "c", entityType: "team", name: "C", attributes: { offense: 10, pointsAllowed: 30 } },
];

describe("custom metric calculations", () => {
  it("treats lower-is-better metrics as stronger heat values", () => {
    expect(metricDesirability(10, [10, 20, 30], "asc")).toBe(1);
    expect(metricDesirability(30, [10, 20, 30], "asc")).toBe(0);
  });

  it("keeps zero-variance populations visually neutral", () => {
    expect(metricDesirability(10, [10, 10, 10], "desc")).toBe(0.5);
  });

  it("maps strength to accessible weak, neutral, and strong bands", () => {
    expect(metricHeatPresentation(0.95)).toMatchObject({ band: "strong", label: "Strong" });
    expect(metricHeatPresentation(0.5)).toMatchObject({ band: "neutral", label: "Middle" });
    expect(metricHeatPresentation(0.05)).toMatchObject({ band: "weak", label: "Weak" });
    expect(metricHeatPresentation(null)).toMatchObject({ band: "missing", label: "No data" });
  });

  it("explains model and metric movement against the user's rank", () => {
    expect(rankDifference(11, 5)).toEqual({ amount: 6, label: "↑6", tone: "positive" });
    expect(rankDifference(3, 8)).toEqual({ amount: -5, label: "↓5", tone: "negative" });
    expect(rankDifference(4, 4)).toEqual({ amount: 0, label: "Same", tone: "neutral" });
  });

  it("combines weighted normalized metrics without changing source data", () => {
    const formula: CustomMetricFormula = {
      version: 1,
      normalization: "percentile",
      components: [{ metricKey: "offense", weight: 60 }, { metricKey: "pointsAllowed", weight: 40 }],
    };
    const scores = calculateCustomMetricScores(entities, definitions, formula);
    expect(scores.get("a")).toBe(100);
    expect(scores.get("b")).toBe(50);
    expect(scores.get("c")).toBe(0);
    expect(entities[0].attributes).toEqual({ offense: 30, pointsAllowed: 10 });
  });
});
