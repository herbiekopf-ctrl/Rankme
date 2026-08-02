import { describe, expect, it } from "vitest";
import { formatMetricValue, rankByMetric } from "./metrics";
import type { MetricDefinition, RankableEntity } from "./types";

const metric: MetricDefinition = { key: "margin", label: "Margin", description: "", format: "signed", direction: "desc" };
const entity = (id: string, value: number | null): RankableEntity => ({ id, entityType: "team", name: id, attributes: { margin: value } });

describe("metric rankings", () => {
  it("uses competition ranks for ties and leaves missing data unranked", () => {
    expect(rankByMetric([entity("a", 10), entity("b", 4), entity("c", 10), entity("d", null)], metric).map(({ entity, rank }) => [entity.id, rank]))
      .toEqual([["a", 1], ["c", 1], ["b", 3], ["d", 0]]);
  });

  it("formats signed values", () => {
    expect(formatMetricValue(4.25, metric)).toBe("+4.3");
  });
});
