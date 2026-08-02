import "server-only";

import { z } from "zod";
import type { DatasetEnvelope, MetricDefinition, RankableEntity } from "@/lib/domain/types";

const venueSchema = z.object({
  id: z.number().nullable().optional(),
  name: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  capacity: z.number().nullable().optional(),
});

const teamSchema = z.object({
  id: z.number(),
  school: z.string(),
  mascot: z.string().nullable().optional(),
  abbreviation: z.string().nullable().optional(),
  alternateNames: z.array(z.string()).nullable().optional(),
  conference: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  alternateColor: z.string().nullable().optional(),
  logos: z.array(z.string()).nullable().optional(),
  location: venueSchema.nullable().optional(),
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

const rosterPlayerSchema = z.object({
  id: z.union([z.string(), z.number()]),
  firstName: z.string(),
  lastName: z.string(),
  team: z.string(),
  height: z.number().nullable().optional(),
  weight: z.number().nullable().optional(),
  jersey: z.number().nullable().optional(),
  year: z.number().nullable().optional(),
  position: z.string().nullable().optional(),
  homeCity: z.string().nullable().optional(),
  homeState: z.string().nullable().optional(),
});

export type CfbdTeam = z.infer<typeof teamSchema>;
export type CfbdRecord = z.infer<typeof recordSchema>;
export type CfbdGame = z.infer<typeof gameSchema>;
export type CfbdRosterPlayer = z.infer<typeof rosterPlayerSchema>;

export const TEAM_METRICS: MetricDefinition[] = [
  { key: "wins", label: "Wins", description: "Total wins in the selected season.", format: "integer", direction: "desc" },
  { key: "winPct", label: "Win percentage", description: "Wins plus half of ties divided by games played.", format: "percentage", direction: "desc" },
  { key: "averageMargin", label: "Average margin", description: "Average scoring margin in completed games.", format: "signed", direction: "desc" },
  { key: "pointsPerGame", label: "Points per game", description: "Average points scored in completed games.", format: "decimal", direction: "desc" },
  { key: "pointsAllowedPerGame", label: "Points allowed", description: "Average points allowed in completed games. Lower is better.", format: "decimal", direction: "asc" },
  { key: "strengthOfSchedule", label: "Opponent win %", description: "Combined win percentage of scheduled opponents.", format: "percentage", direction: "desc" },
];

export type CollegeFootballSnapshot = {
  year: number;
  id: string;
  version: string;
  sourceLabel: string;
  refreshedAt: string;
  connected: true;
  upstreamRequests: number;
  warnings: string[];
  teams: RankableEntity[];
  players: RankableEntity[];
  mascots: RankableEntity[];
  towns: RankableEntity[];
  stadiums: RankableEntity[];
};

function refreshSeconds(): number {
  const configured = Number(process.env.CFBD_REFRESH_SECONDS ?? 604_800);
  return Number.isFinite(configured) && configured >= 3_600 ? configured : 604_800;
}

async function fetchCfbd<T>(path: string, params: Record<string, string | number>, schema: z.ZodType<T>): Promise<T> {
  const apiKey = process.env.CFBD_API_KEY;
  if (!apiKey) throw new Error("CFBD_API_KEY is not configured");

  const baseUrl = process.env.CFBD_API_BASE_URL ?? "https://api.collegefootballdata.com";
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));

  const response = await fetch(url, {
    headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` },
    next: { revalidate: refreshSeconds(), tags: ["cfbd", `cfbd:${path}`] },
  });
  if (!response.ok) throw new Error(`CFBD ${path} request failed with status ${response.status}`);
  return schema.parse(await response.json());
}

function round(value: number, places = 3): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
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
    const completed = teamGames.filter((game) => game.completed && game.homePoints != null && game.awayPoints != null);
    const upcoming = teamGames.find((game) => !game.completed);
    const lastGame = completed.at(-1);
    const ties = record?.total.ties ?? 0;
    const gamesPlayed = record?.total.games ?? ((record?.total.wins ?? 0) + (record?.total.losses ?? 0) + ties);
    let pointsFor = 0;
    let pointsAgainst = 0;
    for (const game of completed) {
      const isHome = game.homeTeam === team.school;
      pointsFor += (isHome ? game.homePoints : game.awayPoints) ?? 0;
      pointsAgainst += (isHome ? game.awayPoints : game.homePoints) ?? 0;
    }
    const opponentRecords = teamGames
      .map((game) => recordsByName.get(game.homeTeam === team.school ? game.awayTeam : game.homeTeam))
      .filter((value): value is CfbdRecord => Boolean(value));
    const opponentWins = opponentRecords.reduce((sum, value) => sum + value.total.wins + (value.total.ties ?? 0) * 0.5, 0);
    const opponentGames = opponentRecords.reduce(
      (sum, value) => sum + (value.total.games ?? value.total.wins + value.total.losses + (value.total.ties ?? 0)),
      0,
    );

    return {
      id: `team:${team.id}`,
      externalIds: { cfbd: String(team.id) },
      entityType: "team",
      name: team.school,
      shortName: team.abbreviation ?? undefined,
      aliases: [team.abbreviation, team.mascot, ...(team.alternateNames ?? [])].filter((value): value is string => Boolean(value)),
      imageUrl: team.logos?.[0],
      color: team.color ?? "#364152",
      attributes: {
        mascot: team.mascot ?? "",
        conference: team.conference ?? record?.conference ?? "Independent",
        town: team.location?.city ?? "",
        state: team.location?.state ?? "",
        record: record ? `${record.total.wins}-${record.total.losses}${ties ? `-${ties}` : ""}` : "0-0",
        wins: record?.total.wins ?? 0,
        losses: record?.total.losses ?? 0,
        gamesPlayed,
        winPct: gamesPlayed > 0 ? round(((record?.total.wins ?? 0) + ties * 0.5) / gamesPlayed) : null,
        averageMargin: completed.length ? round((pointsFor - pointsAgainst) / completed.length, 1) : null,
        pointsPerGame: completed.length ? round(pointsFor / completed.length, 1) : null,
        pointsAllowedPerGame: completed.length ? round(pointsAgainst / completed.length, 1) : null,
        strengthOfSchedule: opponentGames ? round(opponentWins / opponentGames) : null,
        lastResult: lastGame ? gameLabel(lastGame, team.school) : "No result yet",
        nextOpponent: upcoming ? gameLabel(upcoming, team.school) : "Schedule pending",
        suggestion: completed.length === 0 ? "Preseason candidate" : `${record?.total.wins ?? 0} wins · ${round((pointsFor - pointsAgainst) / completed.length, 1) >= 0 ? "+" : ""}${round((pointsFor - pointsAgainst) / completed.length, 1)} avg margin`,
      },
    } satisfies RankableEntity;
  });
}

export function buildPlayerEntities(players: CfbdRosterPlayer[], teams: RankableEntity[]): RankableEntity[] {
  const teamsByName = new Map(teams.map((team) => [team.name, team]));
  return players.map((player) => {
    const team = teamsByName.get(player.team);
    const hometown = [player.homeCity, player.homeState].filter(Boolean).join(", ");
    return {
      id: `player:${player.id}`,
      externalIds: { cfbd: String(player.id) },
      entityType: "player",
      name: `${player.firstName} ${player.lastName}`.trim(),
      shortName: player.position ?? undefined,
      aliases: [player.team, player.position, player.jersey == null ? null : `#${player.jersey}`].filter((value): value is string => Boolean(value)),
      imageUrl: team?.imageUrl,
      color: team?.color ?? "#364152",
      attributes: {
        team: player.team,
        conference: team?.attributes.conference ?? "",
        position: player.position ?? "",
        jersey: player.jersey == null ? "" : `#${player.jersey}`,
        classYear: player.year ?? "",
        height: player.height ?? null,
        weight: player.weight ?? null,
        hometown,
      },
    } satisfies RankableEntity;
  });
}

export function buildDerivedEntities(teams: CfbdTeam[], teamEntities: RankableEntity[]) {
  const teamsByExternalId = new Map(teamEntities.map((entity) => [entity.externalIds?.cfbd, entity]));
  const mascots: RankableEntity[] = [];
  const stadiums: RankableEntity[] = [];
  const townsByKey = new Map<string, { city: string; state: string; teams: string[]; color: string }>();

  for (const team of teams) {
    const source = teamsByExternalId.get(String(team.id));
    if (team.mascot) {
      mascots.push({
        id: `mascot:${team.id}`,
        entityType: "mascot",
        name: `${team.school} ${team.mascot}`,
        shortName: team.mascot,
        aliases: [team.school, team.mascot],
        imageUrl: source?.imageUrl,
        color: source?.color,
        attributes: { school: team.school, mascot: team.mascot, conference: team.conference ?? "Independent" },
      });
    }
    if (team.location?.name) {
      stadiums.push({
        id: `stadium:${team.location.id ?? team.id}`,
        entityType: "stadium",
        name: team.location.name,
        aliases: [team.school, team.location.city, team.location.state].filter((value): value is string => Boolean(value)),
        imageUrl: source?.imageUrl,
        color: source?.color,
        attributes: {
          team: team.school,
          city: [team.location.city, team.location.state].filter(Boolean).join(", "),
          capacity: team.location.capacity ?? null,
          conference: team.conference ?? "Independent",
        },
      });
    }
    if (team.location?.city) {
      const key = `${team.location.city}|${team.location.state ?? ""}`;
      const existing = townsByKey.get(key);
      if (existing) existing.teams.push(team.school);
      else townsByKey.set(key, { city: team.location.city, state: team.location.state ?? "", teams: [team.school], color: source?.color ?? "#364152" });
    }
  }

  const towns: RankableEntity[] = [...townsByKey.entries()].map(([key, town]) => ({
    id: `town:${key.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    entityType: "town",
    name: town.city,
    shortName: town.state,
    aliases: [...town.teams, town.state],
    color: town.color,
    attributes: { state: town.state, schools: town.teams.join(", "), teamCount: town.teams.length },
  }));

  return { mascots, stadiums, towns };
}

export async function pullCollegeFootballSnapshot(year: number): Promise<CollegeFootballSnapshot> {
  const rosterRequest = fetchCfbd("/roster", { year, classification: "fbs" }, z.array(rosterPlayerSchema))
    .then((players) => ({ players, warning: null }))
    .catch(() => ({
      players: [] as CfbdRosterPlayer[],
      warning: "Player rosters were unavailable during this refresh. Team comparisons and non-player polls still use live CFBD data.",
    }));
  const [teams, records, games, rosterResult] = await Promise.all([
    fetchCfbd("/teams/fbs", { year }, z.array(teamSchema)),
    fetchCfbd("/records", { year }, z.array(recordSchema)),
    fetchCfbd("/games", { year, seasonType: "regular", classification: "fbs" }, z.array(gameSchema)),
    rosterRequest,
  ]);

  const teamEntities = buildTeamEntities(teams, records, games);
  const derived = buildDerivedEntities(teams, teamEntities);
  const refreshedAt = new Date().toISOString();
  return {
    year,
    id: `college-football-${year}`,
    version: `cfbd-${year}-${refreshedAt}`,
    sourceLabel: "CollegeFootballData saved snapshot",
    refreshedAt,
    connected: true,
    upstreamRequests: 4,
    warnings: rosterResult.warning ? [rosterResult.warning] : [],
    teams: teamEntities,
    players: buildPlayerEntities(rosterResult.players, teamEntities),
    ...derived,
  };
}

export function teamsDataset(snapshot: CollegeFootballSnapshot): DatasetEnvelope {
  return {
    id: `${snapshot.id}-teams`,
    version: snapshot.version,
    source: "collegefootballdata",
    sourceLabel: snapshot.sourceLabel,
    refreshedAt: snapshot.refreshedAt,
    stale: false,
    connected: true,
    credentialConfigured: true,
    refreshMode: "saved-snapshot",
    upstreamRequests: snapshot.upstreamRequests,
    warnings: snapshot.warnings,
    metricDefinitions: TEAM_METRICS,
    entities: snapshot.teams,
  };
}
