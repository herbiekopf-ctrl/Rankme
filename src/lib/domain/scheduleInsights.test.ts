import { describe, expect, it } from "vitest";
import { buildTeamStrengthIndex, signatureResults } from "./scheduleInsights";

describe("team schedule insights", () => {
  it("builds a direction-aware composite opponent-strength order", () => {
    const index = buildTeamStrengthIndex([
      { entityId: "elite", key: "fpi", value: 25 },
      { entityId: "middle", key: "fpi", value: 10 },
      { entityId: "weak", key: "fpi", value: -8 },
      { entityId: "elite", key: "apRank", value: 2 },
      { entityId: "middle", key: "apRank", value: 15 },
      { entityId: "weak", key: "apRank", value: 50 },
    ]);
    expect(index.get("elite")).toMatchObject({ rank: 1, label: "Elite" });
    expect(index.get("weak")?.rank).toBe(3);
    expect(index.get("elite")!.score).toBeGreaterThan(index.get("middle")!.score);
  });

  it("finds the strongest defeated opponent and weakest loss", () => {
    const games = [
      { id: "a", result: "W" as const, difficultyScore: 0.85 },
      { id: "b", result: "W" as const, difficultyScore: 0.45 },
      { id: "c", result: "L" as const, difficultyScore: 0.7 },
      { id: "d", result: "L" as const, difficultyScore: 0.2 },
    ];
    expect(signatureResults(games)).toEqual({ bestWin: games[0], worstLoss: games[3] });
    expect(signatureResults(games.filter((game) => game.result === "W"))).toMatchObject({ worstLoss: null });
  });
});
