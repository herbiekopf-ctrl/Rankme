import "server-only";

import { z } from "zod";
import type { DatasetEnvelope, RankableEntity } from "@/lib/domain/types";

const teamSchema = z.object({
  id: z.number(),
  school: z.string(),
  mascot: z.string().nullable().optional(),
  abbreviation: z.string().nullable().optional(),
  conference: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  logos: z.array(z.string()).nullable().optional(),
});

const recordSchema = z.object({
  teamId: z.number().nullable().optional(),
  team: z.string(),
  conference: z.string().nullable().optional(),
  total: z.object({
    games: z.number().optional(),
    wins: z.number(),
    losses: z.number(),
    ties: z.number().nullable().optional(),
  }),
});

const gameSchema = z.object({
  id: z.number(),
  week: z.number(),
  startDate: z.string().nullable().optional(),
  completed: z.boolean().optional().default(false),
  homeTeam: z.string(),
  homePoints: z.number().nullable().optional(),
  awayTeam: z.string(),
  awayPoints: z.number().nullable().optional(),
});

export type CfbdTeam = z.infer<typeof teamSchema>;
export type CfbdRecord = z.infer<typeof recordSchema>;
export type CfbdGame = z.infer<typeof gameSchema>;

async function fetchCfbd<T>(path: string, params: Record<string, string | number>, schema: z.ZodType<T>): Promise<T> {
  const apiKey = process.env.CFBD_API_KEY;
  if (!apiKey) throw new Error("CFBD_API_KEY is not configured");

  const baseUrl = process.env.CFBD_API_BASE_URL ?? "https://api.collegefootballdata.com";
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));

  const response = await fetch(url, {
    headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` },
    next: { revalidate: 21_600, tags: ["cfbd", `cfbd:${path}`] },
  });
  if (!response.ok) throw new Error(`CFBD request failed with status ${response.status}`);
  return schema.parse(await response.json());
}

function gameLabel(game: CfbdGame, team: string): string {
  const isHome = game.homeTeam === team;
  const opponent = isHome ? game.awayTeam : game.homeTeam;
  if (!game.completed) return `${isHome ? "vs" : "at"} ${opponent}`;
  const teamPoints = isHome ? game.homePoints : game.awayPoints;
  const opponentPoints = isHome ? game.awayPoints : game.homePoints;
  if (teamPoints == null || opponentPoints == null) return `${isHome ? "vs" : "at"} ${opponent}`;
  const result = teamPoints > opponentPoints ? "W" : teamPoints < opponentPoints ? "L" : "T";
  return `${result} ${teamPoints}-${opponentPoints} ${isHome ? "vs" : "at"} ${opponent}`;
}

export function buildTeamEntities(teams: CfbdTeam[], records: CfbdRecord[], games: CfbdGame[]): RankableEntity[] {
  const recordsById = new Map(records.filter((record) => record.teamId != null).map((record) => [record.teamId, record]));
  const recordsByName = new Map(records.map((record) => [record.team, record]));

  return teams.map((team) => {
    const record = recordsById.get(team.id) ?? recordsByName.get(team.school);
    const teamGames = games
      .filter((game) => game.homeTeam === team.school || game.awayTeam === team.school)
      .sort((a, b) => a.week - b.week);
    const completed = teamGames.filter((game) => game.completed);
    const upcoming = teamGames.find((game) => !game.completed);
    const lastGame = completed.at(-1);
    const ties = record?.total.ties ?? 0;

    return {
      id: `team:${team.id}`,
      externalIds: { cfbd: String(team.id) },
      entityType: "team",
      name: team.school,
      shortName: team.abbreviation ?? undefined,
      aliases: [team.abbreviation, team.mascot].filter((value): value is string => Boolean(value)),
      imageUrl: team.logos?.[0],
      color: team.color ?? "#364152",
      attributes: {
        mascot: team.mascot ?? "",
        conference: team.conference ?? record?.conference ?? "Independent",
        record: record ? `${record.total.wins}-${record.total.losses}${ties ? `-${ties}` : ""}` : "0-0",
        lastResult: lastGame ? gameLabel(lastGame, team.school) : "No result yet",
        nextOpponent: upcoming ? gameLabel(upcoming, team.school) : "Schedule pending",
        suggestion: completed.length === 0 ? "Preseason candidate" : `${record?.total.wins ?? 0} wins`,
      },
    } satisfies RankableEntity;
  });
}

export async function getCollegeFootballDataset(year: number): Promise<DatasetEnvelope> {
  const [teams, records, games] = await Promise.all([
    fetchCfbd("/teams/fbs", { year }, z.array(teamSchema)),
    fetchCfbd("/records", { year }, z.array(recordSchema)),
    fetchCfbd(
      "/games",
      { year, seasonType: "regular", classification: "fbs" },
      z.array(gameSchema),
    ),
  ]);

  const refreshedAt = new Date().toISOString();
  return {
    id: `college-football-teams-${year}`,
    version: `cfbd-${year}-${refreshedAt}`,
    source: "collegefootballdata",
    sourceLabel: "CollegeFootballData",
    refreshedAt,
    stale: false,
    connected: true,
    entities: buildTeamEntities(teams, records, games),
  };
}
