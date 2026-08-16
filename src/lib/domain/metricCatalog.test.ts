import { describe, expect, it } from "vitest";
import { curateMetricDefinitions } from "./metricCatalog";
import type { MetricDefinition, RankableEntity } from "./types";

function metric(key: string, label = key): MetricDefinition {
  return { key, label, description: `${label} description`, format: "decimal", direction: "desc", group: "Other" };
}

function entity(entityType: string, id: string, attributes: RankableEntity["attributes"]): RankableEntity {
  return { id, entityType, name: id, attributes };
}

describe("version-scoped metric catalog", () => {
  it("keeps populated, comparative team metrics and removes stale or zero-variance choices", () => {
    const definitions = [metric("fpi"), metric("spOverall"), metric("wins"), metric("advanced:stale")];
    const entities = [
      entity("team", "team:1", { fpi: 18.2, spOverall: 21.4, wins: 0 }),
      entity("team", "team:2", { fpi: 9.1, spOverall: 14.2, wins: 0 }),
      entity("team", "team:3", { fpi: -2.4 }),
    ];

    const catalog = curateMetricDefinitions("team", definitions, entities);

    expect(catalog.map((entry) => entry.key)).toEqual(["fpi", "spOverall"]);
    expect(catalog[0]).toMatchObject({
      label: "FPI",
      group: "Power",
      tier: "core",
      populatedEntityCount: 3,
      eligibleEntityCount: 3,
      coverage: 1,
      distinctValueCount: 3,
      available: true,
      comparative: true,
    });
    expect(catalog[1]?.coverage).toBeCloseTo(2 / 3);
  });

  it("uses stadium-specific defaults and retains useful advanced geographic values", () => {
    const definitions = [metric("longitude"), metric("capacity"), metric("constructionYear")];
    const entities = [
      entity("stadium", "stadium:1", { capacity: 85000, constructionYear: 1920, longitude: -83.1 }),
      entity("stadium", "stadium:2", { capacity: 71000, constructionYear: 1996, longitude: -81.2 }),
    ];

    const catalog = curateMetricDefinitions("stadium", definitions, entities);

    expect(catalog.map((entry) => [entry.key, entry.tier])).toEqual([
      ["capacity", "core"],
      ["constructionYear", "core"],
      ["longitude", "advanced"],
    ]);
  });

  it("does not invent town metrics or advertise units without numeric data", () => {
    const towns = [
      entity("town", "town:a", { state: "A", schools: "Alpha", teamCount: 1 }),
      entity("town", "town:b", { state: "B", schools: "Beta", teamCount: 1 }),
    ];
    expect(curateMetricDefinitions("town", [metric("teamCount"), metric("population")], towns)).toEqual([]);
    expect(curateMetricDefinitions("unit", [metric("SuccessRate")], [entity("unit", "unit:1", { team: "Alpha" })])).toEqual([]);
  });
});
