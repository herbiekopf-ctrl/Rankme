import { describe, expect, it } from "vitest";
import { buildTeamEntities, type CfbdGame, type CfbdRecord, type CfbdTeam } from "./cfbd";

describe("CFBD adapter", () => {
  it("maps source ids to canonical entities and derives schedule context", () => {
    const teams: CfbdTeam[] = [{ id: 228, school: "Clemson", mascot: "Tigers", abbreviation: "CLEM", conference: "ACC", color: "#F56600", logos: [] }];
    const records: CfbdRecord[] = [{ teamId: 228, team: "Clemson", conference: "ACC", total: { games: 2, wins: 1, losses: 1, ties: 0 } }];
    const games: CfbdGame[] = [
      { id: 1, week: 1, completed: true, homeTeam: "Clemson", homePoints: 31, awayTeam: "LSU", awayPoints: 24 },
      { id: 2, week: 2, completed: false, homeTeam: "Georgia Tech", homePoints: null, awayTeam: "Clemson", awayPoints: null },
    ];

    const [entity] = buildTeamEntities(teams, records, games);
    expect(entity.id).toBe("team:228");
    expect(entity.externalIds).toEqual({ cfbd: "228" });
    expect(entity.attributes.record).toBe("1-1");
    expect(entity.attributes.lastResult).toBe("W 31-24 vs LSU");
    expect(entity.attributes.nextOpponent).toBe("at Georgia Tech");
  });
});
