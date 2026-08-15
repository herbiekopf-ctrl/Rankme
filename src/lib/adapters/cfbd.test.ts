import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTeamEntities, pullCollegeFootballSnapshot, type CfbdGame, type CfbdRecord, type CfbdTeam } from "./cfbd";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

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
    expect(entity.attributes.averageMargin).toBe(7);
    expect(entity.attributes.pointsPerGame).toBe(31);
  });

  it("uses the server-only bearer key for one shared approved-data snapshot", async () => {
    vi.stubEnv("CFBD_API_KEY", "test-secret-never-rendered");
    const responses: Record<string, unknown> = {
      "/teams/fbs": [{
        id: 228,
        school: "Clemson",
        mascot: "Tigers",
        abbreviation: "CLEM",
        conference: "ACC",
        color: "#F56600",
        logos: [],
        location: { id: 1, name: "Memorial Stadium", city: "Clemson", state: "SC", capacity: 81500 },
      }],
      "/records": [{ teamId: 228, team: "Clemson", conference: "ACC", total: { games: 1, wins: 1, losses: 0, ties: 0 } }],
      "/games": [{ id: 1, week: 1, completed: true, homeTeam: "Clemson", homePoints: 31, awayTeam: "LSU", awayPoints: 24 }],
      "/roster": [{ id: "7", firstName: "Sammy", lastName: "Receiver", team: "Clemson", position: "WR", jersey: 7, year: 3 }],
    };
    const requestSpy = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test-secret-never-rendered");
      if (url.pathname !== "/venues") expect(url.searchParams.get("year")).toBe("2026");
      return new Response(JSON.stringify(responses[url.pathname] ?? []), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", requestSpy);

    const snapshot = await pullCollegeFootballSnapshot(2026);

    expect(requestSpy).toHaveBeenCalledTimes(19);
    expect(snapshot.upstreamRequests).toBe(19);
    expect(snapshot.teams).toHaveLength(1);
    expect(snapshot.players[0]?.attributes.position).toBe("WR");
    expect(snapshot.stadiums[0]?.name).toBe("Memorial Stadium");
    expect(snapshot.towns[0]?.name).toBe("Clemson");
    expect(snapshot.units).toHaveLength(2);
    expect(snapshot.teamSeasons).toHaveLength(1);
    expect(Object.keys(snapshot.teams[0]?.attributes ?? {}).some((key) => key.startsWith("advanced:") || key.startsWith("stat:team:") || key.startsWith("usage:"))).toBe(false);
    expect(snapshot.warnings).toEqual([]);
  });

  it("keeps team data live when the optional roster endpoint is unavailable", async () => {
    vi.stubEnv("CFBD_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const path = new URL(String(input)).pathname;
      if (path === "/roster") return new Response("unavailable", { status: 503 });
      const body = path === "/teams/fbs"
        ? [{ id: 228, school: "Clemson", conference: "ACC" }]
        : [];
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const snapshot = await pullCollegeFootballSnapshot(2026);
    expect(snapshot.teams).toHaveLength(1);
    expect(snapshot.players).toEqual([]);
    expect(snapshot.warnings[0]).toContain("Player rosters");
  });
});
