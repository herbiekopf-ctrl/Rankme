import { describe, expect, it } from "vitest";
import { buildConsensusHistorySeries, consensusMovementLabel } from "./consensusHistory";

describe("consensus history", () => {
  const periods = [
    { positions: [{ entityId: "a", name: "Alpha", imageUrl: null, color: "#123", position: 5 }, { entityId: "b", name: "Beta", imageUrl: null, color: null, position: 2 }] },
    { positions: [{ entityId: "a", name: "Alpha", imageUrl: null, color: "#123", position: 3 }, { entityId: "c", name: "Gamma", imageUrl: null, color: null, position: 8 }] },
    { positions: [{ entityId: "a", name: "Alpha", imageUrl: null, color: "#123", position: 1 }, { entityId: "c", name: "Gamma", imageUrl: null, color: null, position: 6 }] },
  ];

  it("keeps entries and exits while sorting current teams first", () => {
    const series = buildConsensusHistorySeries(periods);
    expect(series.map((team) => team.entityId)).toEqual(["a", "c", "b"]);
    expect(series.find((team) => team.entityId === "a")?.points.map((point) => point.position)).toEqual([5, 3, 1]);
  });

  it("describes rises and exits from the latest available points", () => {
    const series = buildConsensusHistorySeries(periods);
    expect(consensusMovementLabel(series[0], 2)).toBe("Rose 2 to #1");
    expect(consensusMovementLabel(series[1], 2)).toBe("Rose 2 to #6");
    expect(consensusMovementLabel(series[2], 2)).toBe("Exited after reaching #2");
  });
});
