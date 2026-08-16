import { describe, expect, it } from "vitest";
import { mergePriorSeasonContext } from "./priorSeasonContext";
import type { DatasetEnvelope, MetricDefinition } from "./types";

const winMetric: MetricDefinition = { key: "wins", label: "Wins", description: "Season wins.", format: "integer", direction: "desc", group: "Resume" };

function dataset(version: string, gamesPlayed: number, wins: number): DatasetEnvelope {
  return {
    id: version,
    version,
    source: "collegefootballdata",
    sourceLabel: "Season data",
    refreshedAt: "2026-08-01T00:00:00.000Z",
    stale: false,
    connected: true,
    metricDefinitions: [winMetric],
    entities: [{ id: "team:1", entityType: "team", name: "Alpha", attributes: { gamesPlayed, wins } }],
  };
}

describe("prior-season context", () => {
  it("labels and exposes a narrow prior-season metric set during preseason", () => {
    const merged = mergePriorSeasonContext(dataset("2026", 0, 0), dataset("2025", 12, 10), 2026);
    expect(merged.entities[0].attributes["prior:2025:wins"]).toBe(10);
    expect(merged.metricDefinitions).toContainEqual(expect.objectContaining({ key: "prior:2025:wins", label: "2025 Wins", context: "prior-season", season: 2025, tier: "advanced" }));
  });

  it("stops adding prior team results after the early-season window", () => {
    expect(mergePriorSeasonContext(dataset("2026", 3, 2), dataset("2025", 12, 10), 2026)).toEqual(dataset("2026", 3, 2));
  });
});
