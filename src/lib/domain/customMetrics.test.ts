import { describe, expect, it } from "vitest";
import { calculateCustomMetricScores, metricDesirability } from "./metrics";
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
