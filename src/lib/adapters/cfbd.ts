import "server-only";

import { z } from "zod";
import type { DatasetEnvelope, MetricDefinition, RankableEntity } from "@/lib/domain/types";

const venueSchema = z.object({
  id: z.number().nullable().optional(),
  name: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zip: z.string().nullable().optional(),
  countryCode: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  elevation: z.union([z.string(), z.number()]).nullable().optional(),
  capacity: z.number().nullable().optional(),
  constructionYear: z.number().nullable().optional(),
  grass: z.boolean().nullable().optional(),
  dome: z.boolean().nullable().optional(),
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
  year: z.number().optional(),
  teamId: z.number().nullable().optional(),
  team: z.string(),
  conference: z.string().nullable().optional(),
  expectedWins: z.number().nullable().optional(),
  total: z.object({
    games: z.number().optional(),
    wins: z.number(),
    losses: z.number(),
    ties: z.number().nullable().optional(),
  }),
  conferenceGames: z.object({ games: z.number().optional(), wins: z.number(), losses: z.number(), ties: z.number().nullable().optional() }).nullable().optional(),
  postseason: z.object({ games: z.number().optional(), wins: z.number(), losses: z.number(), ties: z.number().nullable().optional() }).nullable().optional(),
});

const gameSchema = z.object({
  id: z.number(),
  season: z.number().optional(),
  week: z.number(),
  startDate: z.string().nullable().optional(),
  completed: z.boolean().optional().default(false),
  neutralSite: z.boolean().nullable().optional(),
  conferenceGame: z.boolean().nullable().optional(),
  attendance: z.number().nullable().optional(),
  venue: z.string().nullable().optional(),
  homeId: z.number().nullable().optional(),
  homeTeam: z.string(),
  homeConference: z.string().nullable().optional(),
  homePoints: z.number().nullable().optional(),
  awayId: z.number().nullable().optional(),
  awayTeam: z.string(),
  awayConference: z.string().nullable().optional(),
  awayPoints: z.number().nullable().optional(),
  excitementIndex: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
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

const coachSeasonSchema = z.object({
  teamId: z.number().nullable().optional(),
  school: z.string(),
  conference: z.string().nullable().optional(),
  year: z.number(),
  games: z.number().nullable().optional(),
  wins: z.number().nullable().optional(),
  losses: z.number().nullable().optional(),
  ties: z.number().nullable().optional(),
  winPercentage: z.number().nullable().optional(),
  srs: z.number().nullable().optional(),
  spOverall: z.number().nullable().optional(),
  spOffense: z.number().nullable().optional(),
  spDefense: z.number().nullable().optional(),
});

const coachSchema = z.object({
  id: z.number(),
  firstName: z.string(),
  lastName: z.string(),
  hireDate: z.string().nullable().optional(),
  seasons: z.array(coachSeasonSchema).default([]),
});

const teamStatSchema = z.object({
  season: z.number(),
  team: z.string(),
  conference: z.string().nullable().optional(),
  statName: z.string(),
  statValue: z.union([z.string(), z.number()]),
});

const advancedSeasonStatSchema = z.object({
  season: z.number(),
  team: z.string(),
  conference: z.string().nullable().optional(),
  offense: z.record(z.string(), z.unknown()),
  defense: z.record(z.string(), z.unknown()),
});

const teamEloSchema = z.object({ year: z.number(), team: z.string(), conference: z.string().nullable().optional(), elo: z.number() });
const teamSrsSchema = z.object({ year: z.number(), team: z.string(), rating: z.number(), ranking: z.number().nullable().optional() });
const recruitingSchema = z.object({ year: z.number(), rank: z.number(), team: z.string(), points: z.number() });
const talentSchema = z.object({ year: z.number(), team: z.string(), talent: z.number() });
const returningSchema = z.object({
  season: z.number(),
  team: z.string(),
  conference: z.string().nullable().optional(),
  percentPPA: z.number().nullable().optional(),
  usage: z.number().nullable().optional(),
  passingUsage: z.number().nullable().optional(),
  receivingUsage: z.number().nullable().optional(),
  rushingUsage: z.number().nullable().optional(),
});
const pollRankSchema = z.object({ rank: z.number(), teamId: z.number().nullable().optional(), school: z.string() });
const pollWeekSchema = z.object({
  season: z.number(),
  week: z.number(),
  polls: z.array(z.object({ poll: z.string(), ranks: z.array(pollRankSchema) })),
});
const flexibleRowSchema = z.record(z.string(), z.unknown());
type FlexibleRow = z.infer<typeof flexibleRowSchema>;
const flexibleRowsSchema = z.array(flexibleRowSchema);

export type CfbdTeam = z.infer<typeof teamSchema>;
export type CfbdRecord = z.infer<typeof recordSchema>;
export type CfbdGame = z.infer<typeof gameSchema>;
export type CfbdRosterPlayer = z.infer<typeof rosterPlayerSchema>;
type CfbdCoach = z.infer<typeof coachSchema>;
type CfbdTeamStat = z.infer<typeof teamStatSchema>;
type CfbdAdvancedSeasonStat = z.infer<typeof advancedSeasonStatSchema>;

export const TEAM_METRICS: MetricDefinition[] = [
  { key: "wins", label: "Wins", description: "Total wins in the selected season.", format: "integer", direction: "desc", group: "Resume", source: "CFBD records" },
  { key: "winPct", label: "Win percentage", description: "Wins plus half of ties divided by games played.", format: "percentage", direction: "desc", group: "Resume", source: "CFBD records" },
  { key: "averageMargin", label: "Average margin", description: "Average scoring margin in completed games.", format: "signed", direction: "desc", group: "Scoring", source: "CFBD games" },
  { key: "pointsPerGame", label: "Points per game", description: "Average points scored in completed games.", format: "decimal", direction: "desc", group: "Scoring", source: "CFBD games" },
  { key: "pointsAllowedPerGame", label: "Points allowed", description: "Average points allowed in completed games. Lower is better.", format: "decimal", direction: "asc", group: "Scoring", source: "CFBD games" },
  { key: "strengthOfSchedule", label: "Opponent win %", description: "Combined win percentage of scheduled opponents.", format: "percentage", direction: "desc", group: "Resume", source: "Derived from CFBD records" },
  { key: "roadWins", label: "Road wins", description: "Wins in completed away games.", format: "integer", direction: "desc", group: "Resume", source: "CFBD games" },
  { key: "recentMargin", label: "Recent form", description: "Average scoring margin over the three most recent completed games.", format: "signed", direction: "desc", group: "Resume", source: "CFBD games" },
  { key: "apRank", label: "AP rank", description: "Latest AP poll position in the saved snapshot.", format: "integer", direction: "asc", group: "Resume", source: "CFBD rankings" },
  { key: "elo", label: "Elo rating", description: "Opponent-adjusted Elo strength rating.", format: "integer", direction: "desc", group: "Power", source: "CFBD Elo" },
  { key: "srs", label: "SRS rating", description: "Simple Rating System strength estimate.", format: "signed", direction: "desc", group: "Power", source: "CFBD SRS" },
  { key: "spOverall", label: "SP+ overall", description: "Opponent-adjusted overall SP+ rating.", format: "signed", direction: "desc", group: "Power", source: "CFBD SP+" },
  { key: "spOffense", label: "SP+ offense", description: "Opponent-adjusted offensive SP+ rating.", format: "signed", direction: "desc", group: "Power", source: "CFBD SP+" },
  { key: "spDefense", label: "SP+ defense", description: "Opponent-adjusted defensive SP+ rating. Lower is better.", format: "signed", direction: "asc", group: "Power", source: "CFBD SP+" },
  { key: "spSpecialTeams", label: "SP+ special teams", description: "Opponent-adjusted special-teams SP+ rating.", format: "signed", direction: "desc", group: "Power", source: "CFBD SP+" },
  { key: "fpi", label: "FPI", description: "Football Power Index team strength rating.", format: "signed", direction: "desc", group: "Power", source: "CFBD FPI" },
  { key: "fpiOffense", label: "FPI offense", description: "FPI offensive efficiency rating.", format: "signed", direction: "desc", group: "Power", source: "CFBD FPI" },
  { key: "fpiDefense", label: "FPI defense", description: "FPI defensive efficiency rating.", format: "signed", direction: "desc", group: "Power", source: "CFBD FPI" },
  { key: "fpiSpecialTeams", label: "FPI special teams", description: "FPI special-teams efficiency rating.", format: "signed", direction: "desc", group: "Power", source: "CFBD FPI" },
  { key: "strengthOfRecordRank", label: "Strength of record", description: "FPI strength-of-record rank. Lower is better.", format: "integer", direction: "asc", group: "Resume", source: "CFBD FPI" },
  { key: "fpiSosRank", label: "FPI SOS rank", description: "FPI strength-of-schedule rank. Lower is better.", format: "integer", direction: "asc", group: "Resume", source: "CFBD FPI" },
  { key: "remainingSosRank", label: "Remaining SOS", description: "FPI remaining strength-of-schedule rank. Lower is harder.", format: "integer", direction: "asc", group: "Resume", source: "CFBD FPI" },
  { key: "gameControlRank", label: "Game control", description: "FPI game-control rank. Lower is better.", format: "integer", direction: "asc", group: "Resume", source: "CFBD FPI" },
  { key: "talent", label: "Team talent", description: "Roster talent composite from recruiting ratings.", format: "decimal", direction: "desc", group: "Roster", source: "CFBD talent" },
  { key: "recruitingRank", label: "Recruiting rank", description: "Team recruiting class rank for the selected year.", format: "integer", direction: "asc", group: "Roster", source: "CFBD recruiting" },
  { key: "returningProduction", label: "Returning PPA", description: "Share of prior production returning to the roster.", format: "percentage", direction: "desc", group: "Roster", source: "CFBD returning production" },
  { key: "passingYardsPerGame", label: "Pass yards / game", description: "Net passing yards divided by games played.", format: "decimal", direction: "desc", group: "Production", source: "CFBD season stats" },
  { key: "rushingYardsPerGame", label: "Rush yards / game", description: "Rushing yards divided by games played.", format: "decimal", direction: "desc", group: "Production", source: "CFBD season stats" },
  { key: "totalYardsPerGame", label: "Total yards / game", description: "Total offense divided by games played.", format: "decimal", direction: "desc", group: "Production", source: "CFBD season stats" },
  { key: "yardsPerPlay", label: "Yards / play", description: "Total offensive yards per rush or pass attempt.", format: "decimal", direction: "desc", group: "Production", source: "CFBD season stats" },
  { key: "passingYardsPerAttempt", label: "Pass yards / attempt", description: "Net passing yards per pass attempt.", format: "decimal", direction: "desc", group: "Production", source: "CFBD season stats" },
  { key: "rushingYardsPerAttempt", label: "Rush yards / attempt", description: "Rushing yards per rushing attempt.", format: "decimal", direction: "desc", group: "Production", source: "CFBD season stats" },
  { key: "totalYardsAllowedPerGame", label: "Yards allowed / game", description: "Opponent total yards per game. Lower is better.", format: "decimal", direction: "asc", group: "Production", source: "CFBD season stats" },
  { key: "yardsAllowedPerPlay", label: "Yards allowed / play", description: "Opponent yards per rush or pass attempt. Lower is better.", format: "decimal", direction: "asc", group: "Production", source: "CFBD season stats" },
  { key: "thirdDownPct", label: "Third-down conversion", description: "Share of offensive third downs converted.", format: "percentage", direction: "desc", group: "Efficiency", source: "CFBD season stats" },
  { key: "thirdDownDefensePct", label: "Third-down defense", description: "Share of opponent third downs converted. Lower is better.", format: "percentage", direction: "asc", group: "Efficiency", source: "CFBD season stats" },
  { key: "turnoverMarginPerGame", label: "Turnover margin / game", description: "Takeaways minus giveaways per game.", format: "signed", direction: "desc", group: "Efficiency", source: "CFBD season stats" },
  { key: "sacksPerGame", label: "Sacks / game", description: "Defensive sacks per game.", format: "decimal", direction: "desc", group: "Efficiency", source: "CFBD season stats" },
  { key: "offensiveSuccessRate", label: "Offensive success rate", description: "Share of offensive plays considered successful.", format: "percentage", direction: "desc", group: "Efficiency", source: "CFBD advanced stats" },
  { key: "defensiveSuccessRate", label: "Defensive success rate allowed", description: "Opponent successful-play rate. Lower is better.", format: "percentage", direction: "asc", group: "Efficiency", source: "CFBD advanced stats" },
  { key: "offensiveExplosiveness", label: "Offensive explosiveness", description: "Efficiency of successful offensive plays.", format: "decimal", direction: "desc", group: "Efficiency", source: "CFBD advanced stats" },
  { key: "defensiveExplosiveness", label: "Explosiveness allowed", description: "Opponent explosiveness. Lower is better.", format: "decimal", direction: "asc", group: "Efficiency", source: "CFBD advanced stats" },
  { key: "offensivePpa", label: "Offensive PPA", description: "Predicted points added per offensive play.", format: "signed", direction: "desc", group: "Efficiency", source: "CFBD advanced stats" },
  { key: "defensivePpa", label: "Defensive PPA allowed", description: "Opponent predicted points added per play. Lower is better.", format: "signed", direction: "asc", group: "Efficiency", source: "CFBD advanced stats" },
  { key: "offensivePointsPerOpportunity", label: "Points / opportunity", description: "Points scored per scoring opportunity.", format: "decimal", direction: "desc", group: "Efficiency", source: "CFBD advanced stats" },
  { key: "defensivePointsPerOpportunity", label: "Points allowed / opportunity", description: "Opponent points per scoring opportunity. Lower is better.", format: "decimal", direction: "asc", group: "Efficiency", source: "CFBD advanced stats" },
  { key: "defensiveHavoc", label: "Defensive havoc", description: "Rate of disruptive defensive plays.", format: "percentage", direction: "desc", group: "Efficiency", source: "CFBD advanced stats" },
];

export const COACH_METRICS: MetricDefinition[] = [
  { key: "careerWins", label: "Career wins", description: "Attributed head-coaching wins in the CFBD record.", format: "integer", direction: "desc", group: "Resume", source: "CFBD coaches" },
  { key: "careerWinPct", label: "Career win %", description: "Career wins divided by attributed games.", format: "percentage", direction: "desc", group: "Resume", source: "CFBD coaches" },
  { key: "currentWins", label: "Current-season wins", description: "Wins in the selected season.", format: "integer", direction: "desc", group: "Resume", source: "CFBD coaches" },
  { key: "srs", label: "Team SRS", description: "Selected-season SRS attached to the coach record.", format: "signed", direction: "desc", group: "Power", source: "CFBD coaches" },
  { key: "spOverall", label: "Team SP+", description: "Selected-season SP+ overall rating.", format: "signed", direction: "desc", group: "Power", source: "CFBD coaches" },
];

export const CONFERENCE_METRICS: MetricDefinition[] = [
  { key: "teamCount", label: "FBS teams", description: "Number of teams in the saved FBS dataset.", format: "integer", direction: "desc", group: "Other", source: "Derived" },
  { key: "totalWins", label: "Total wins", description: "Combined wins for member teams.", format: "integer", direction: "desc", group: "Resume", source: "Derived" },
  { key: "averageWinPct", label: "Average win %", description: "Average member-team win percentage.", format: "percentage", direction: "desc", group: "Resume", source: "Derived" },
  { key: "averageElo", label: "Average Elo", description: "Average Elo of member teams with available ratings.", format: "integer", direction: "desc", group: "Power", source: "Derived" },
  { key: "averageSrs", label: "Average SRS", description: "Average SRS of member teams with available ratings.", format: "signed", direction: "desc", group: "Power", source: "Derived" },
];

export const GAME_METRICS: MetricDefinition[] = [
  { key: "excitementIndex", label: "Excitement index", description: "CFBD in-game excitement measure.", format: "decimal", direction: "desc", group: "Other", source: "CFBD games" },
  { key: "attendance", label: "Attendance", description: "Reported attendance.", format: "integer", direction: "desc", group: "Other", source: "CFBD games" },
  { key: "totalPoints", label: "Total points", description: "Combined points scored.", format: "integer", direction: "desc", group: "Scoring", source: "CFBD games" },
  { key: "scoreMargin", label: "Score margin", description: "Absolute final score margin. Lower means a closer game.", format: "integer", direction: "asc", group: "Scoring", source: "Derived" },
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
  coaches: RankableEntity[];
  conferences: RankableEntity[];
  games: RankableEntity[];
  mascots: RankableEntity[];
  towns: RankableEntity[];
  stadiums: RankableEntity[];
  recruitingClasses: RankableEntity[];
  recruits: RankableEntity[];
  transfers: RankableEntity[];
  units: RankableEntity[];
  teamSeasons: RankableEntity[];
  draftPicks: RankableEntity[];
  metricsByEntityType: Record<string, MetricDefinition[]>;
};

function refreshSeconds(): number {
  const configured = Number(process.env.CFBD_REFRESH_SECONDS ?? 604_800);
  return Number.isFinite(configured) && configured >= 3_600 ? configured : 604_800;
}

async function fetchCfbd<T>(path: string, params: Record<string, string | number | boolean>, schema: z.ZodType<T>): Promise<T> {
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

async function optionalFeed<T>(label: string, request: Promise<T>, fallback: T): Promise<{ data: T; warning?: string }> {
  try {
    return { data: await request };
  } catch {
    return { data: fallback, warning: `${label} were unavailable during this refresh. Other saved datasets remain usable.` };
  }
}

function round(value: number, places = 3): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replaceAll(",", "").replace("%", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function objectNumber(record: Record<string, unknown> | undefined, ...keys: string[]): number | null {
  if (!record) return null;
  for (const key of keys) {
    const value = asNumber(record[key]);
    if (value != null) return value;
  }
  return null;
}

function nestedNumber(record: Record<string, unknown> | undefined, parent: string, ...keys: string[]): number | null {
  const nested = record?.[parent];
  return typeof nested === "object" && nested !== null ? objectNumber(nested as Record<string, unknown>, ...keys) : null;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function pickString(row: FlexibleRow, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function pickNumber(row: FlexibleRow, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = asNumber(row[key]);
    if (value != null) return value;
  }
  return null;
}

function titleFromKey(value: string): string {
  return value
    .replaceAll(":", " · ")
    .replaceAll("-", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function flattenNumericValues(value: unknown, prefix: string, output: Record<string, number> = {}): Record<string, number> {
  if (typeof value === "number" && Number.isFinite(value)) {
    output[prefix] = value;
    return output;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return output;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (["year", "season", "id", "teamId", "playerId", "athleteId"].includes(key)) continue;
    flattenNumericValues(nested, prefix ? `${prefix}:${key}` : key, output);
  }
  return output;
}

function metricDefinitionsFromEntities(
  entities: RankableEntity[],
  source: string,
  defaultGroup: MetricDefinition["group"] = "Other",
): MetricDefinition[] {
  const valuesByKey = new Map<string, number[]>();
  for (const entity of entities) {
    for (const [key, value] of Object.entries(entity.attributes)) {
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      const values = valuesByKey.get(key) ?? [];
      values.push(value);
      valuesByKey.set(key, values);
    }
  }
  return [...valuesByKey.entries()].map(([key, values]) => {
    const lower = key.toLowerCase();
    const ascending = lower.includes("rank") || lower.includes("loss") || lower.includes("allowed") || lower.includes("pick") || lower.includes("round");
    const percentage = lower.includes("pct") || lower.includes("percentage") || lower.includes("rate") || values.every((value) => value >= 0 && value <= 1);
    return {
      key,
      label: titleFromKey(key),
      description: `${titleFromKey(key)} from the saved ${source} dataset.`,
      format: percentage ? "percentage" : values.every(Number.isInteger) ? "integer" : "decimal",
      direction: ascending ? "asc" : "desc",
      group: lower.includes("career") || lower.includes("record") || lower.includes("win") || lower.includes("rank") ? "Resume" : defaultGroup,
      source,
    } satisfies MetricDefinition;
  }).sort((a, b) => a.label.localeCompare(b.label));
}

function mergeMetricDefinitions(...groups: MetricDefinition[][]): MetricDefinition[] {
  const definitions = new Map<string, MetricDefinition>();
  for (const group of groups) for (const metric of group) definitions.set(metric.key, metric);
  return [...definitions.values()];
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
    const teamGames = games.filter((game) => game.homeTeam === team.school || game.awayTeam === team.school).sort((a, b) => a.week - b.week);
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
    const opponentGames = opponentRecords.reduce((sum, value) => sum + (value.total.games ?? value.total.wins + value.total.losses + (value.total.ties ?? 0)), 0);
    const roadWins = completed.filter((game) => game.awayTeam === team.school && (game.awayPoints ?? 0) > (game.homePoints ?? 0)).length;
    const recent = completed.slice(-3);
    const recentMargin = recent.length ? round(recent.reduce((sum, game) => {
      const isHome = game.homeTeam === team.school;
      return sum + ((isHome ? game.homePoints : game.awayPoints) ?? 0) - ((isHome ? game.awayPoints : game.homePoints) ?? 0);
    }, 0) / recent.length, 1) : null;

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
        roadWins,
        recentMargin,
        lastResult: lastGame ? gameLabel(lastGame, team.school) : "No result yet",
        nextOpponent: upcoming ? gameLabel(upcoming, team.school) : "Schedule pending",
        suggestion: completed.length === 0 ? "Preseason candidate" : `${record?.total.wins ?? 0} wins · ${round((pointsFor - pointsAgainst) / completed.length, 1) >= 0 ? "+" : ""}${round((pointsFor - pointsAgainst) / completed.length, 1)} avg margin`,
      },
    } satisfies RankableEntity;
  });
}

function enrichTeamEntities(
  entities: RankableEntity[],
  teamStats: CfbdTeamStat[],
  advancedStats: CfbdAdvancedSeasonStat[],
  elo: z.infer<typeof teamEloSchema>[],
  srs: z.infer<typeof teamSrsSchema>[],
  polls: z.infer<typeof pollWeekSchema>[],
  recruiting: z.infer<typeof recruitingSchema>[],
  talent: z.infer<typeof talentSchema>[],
  returning: z.infer<typeof returningSchema>[],
  spRows: FlexibleRow[] = [],
  fpiRows: FlexibleRow[] = [],
): RankableEntity[] {
  const statMap = new Map<string, Map<string, number>>();
  for (const row of teamStats) {
    const value = asNumber(row.statValue);
    if (value == null) continue;
    const team = statMap.get(row.team) ?? new Map<string, number>();
    team.set(row.statName.toLowerCase().replace(/[^a-z0-9]/g, ""), value);
    statMap.set(row.team, team);
  }
  const advancedByTeam = new Map(advancedStats.map((row) => [row.team, row]));
  const eloByTeam = new Map(elo.map((row) => [row.team, row.elo]));
  const srsByTeam = new Map(srs.map((row) => [row.team, row.rating]));
  const recruitingByTeam = new Map(recruiting.map((row) => [row.team, row]));
  const talentByTeam = new Map(talent.map((row) => [row.team, row.talent]));
  const returningByTeam = new Map(returning.map((row) => [row.team, row]));
  const latestPollWeek = [...polls].sort((a, b) => a.week - b.week).at(-1);
  const apPoll = latestPollWeek?.polls.find((poll) => poll.poll.toLowerCase().includes("ap"));
  const apRanks = new Map(apPoll?.ranks.map((row) => [row.school, row.rank]) ?? []);
  const ratingRows = (rows: FlexibleRow[], prefix: string) => new Map(rows.flatMap((row) => {
    const team = pickString(row, "team", "school");
    return team ? [[team, flattenNumericValues(row, prefix)] as const] : [];
  }));
  const spByTeam = ratingRows(spRows, "sp");
  const fpiByTeam = ratingRows(fpiRows, "fpi");
  const selected = (values: Record<string, number> | undefined, ...suffixes: string[]) => {
    if (!values) return null;
    for (const suffix of suffixes) {
      const match = Object.entries(values).find(([key]) => key.toLowerCase().endsWith(suffix.toLowerCase()));
      if (match) return match[1];
    }
    return null;
  };

  return entities.map((entity) => {
    const stats = statMap.get(entity.name);
    const gamesPlayed = asNumber(entity.attributes.gamesPlayed) ?? 0;
    const stat = (...keys: string[]) => {
      for (const key of keys) {
        const value = stats?.get(key.toLowerCase().replace(/[^a-z0-9]/g, ""));
        if (value != null) return value;
      }
      return null;
    };
    const advanced = advancedByTeam.get(entity.name);
    const recruitingRow = recruitingByTeam.get(entity.name);
    const returningRow = returningByTeam.get(entity.name);
    const passingYards = stat("netPassingYards", "passingYards");
    const rushingYards = stat("rushingYards");
    const totalYards = stat("totalYards", "totalOffense");
    const passingAttempts = stat("passAttempts");
    const rushingAttempts = stat("rushingAttempts");
    const totalYardsAllowed = stat("totalYardsOpponent");
    const opponentPassingAttempts = stat("passAttemptsOpponent");
    const opponentRushingAttempts = stat("rushingAttemptsOpponent");
    const thirdDowns = stat("thirdDowns");
    const thirdDownConversions = stat("thirdDownConversions");
    const opponentThirdDowns = stat("thirdDownsOpponent");
    const opponentThirdDownConversions = stat("thirdDownConversionsOpponent");
    const turnovers = stat("turnovers");
    const takeaways = stat("turnoversOpponent");
    return {
      ...entity,
      attributes: {
        ...entity.attributes,
        apRank: apRanks.get(entity.name) ?? null,
        elo: eloByTeam.get(entity.name) ?? null,
        srs: srsByTeam.get(entity.name) ?? null,
        spOverall: selected(spByTeam.get(entity.name), ":rating", ":overall", ":overall:rating"),
        spOffense: selected(spByTeam.get(entity.name), ":offense:rating", ":offense"),
        spDefense: selected(spByTeam.get(entity.name), ":defense:rating", ":defense"),
        spSpecialTeams: selected(spByTeam.get(entity.name), ":specialTeams:rating", ":specialTeams"),
        fpi: selected(fpiByTeam.get(entity.name), ":fpi", ":rating"),
        fpiOffense: selected(fpiByTeam.get(entity.name), ":efficiencies:offense"),
        fpiDefense: selected(fpiByTeam.get(entity.name), ":efficiencies:defense"),
        fpiSpecialTeams: selected(fpiByTeam.get(entity.name), ":efficiencies:specialTeams"),
        strengthOfRecordRank: selected(fpiByTeam.get(entity.name), ":resumeRanks:strengthOfRecord"),
        fpiSosRank: selected(fpiByTeam.get(entity.name), ":resumeRanks:strengthOfSchedule"),
        remainingSosRank: selected(fpiByTeam.get(entity.name), ":resumeRanks:remainingStrengthOfSchedule"),
        gameControlRank: selected(fpiByTeam.get(entity.name), ":resumeRanks:gameControl"),
        talent: talentByTeam.get(entity.name) ?? null,
        recruitingRank: recruitingRow?.rank ?? null,
        recruitingPoints: recruitingRow?.points ?? null,
        returningProduction: returningRow?.percentPPA ?? null,
        passingYardsPerGame: gamesPlayed && passingYards != null ? round(passingYards / gamesPlayed, 1) : null,
        rushingYardsPerGame: gamesPlayed && rushingYards != null ? round(rushingYards / gamesPlayed, 1) : null,
        totalYardsPerGame: gamesPlayed && totalYards != null ? round(totalYards / gamesPlayed, 1) : null,
        yardsPerPlay: totalYards != null && (passingAttempts ?? 0) + (rushingAttempts ?? 0) > 0 ? round(totalYards / ((passingAttempts ?? 0) + (rushingAttempts ?? 0)), 2) : null,
        passingYardsPerAttempt: passingYards != null && passingAttempts ? round(passingYards / passingAttempts, 2) : null,
        rushingYardsPerAttempt: rushingYards != null && rushingAttempts ? round(rushingYards / rushingAttempts, 2) : null,
        totalYardsAllowedPerGame: gamesPlayed && totalYardsAllowed != null ? round(totalYardsAllowed / gamesPlayed, 1) : null,
        yardsAllowedPerPlay: totalYardsAllowed != null && (opponentPassingAttempts ?? 0) + (opponentRushingAttempts ?? 0) > 0 ? round(totalYardsAllowed / ((opponentPassingAttempts ?? 0) + (opponentRushingAttempts ?? 0)), 2) : null,
        thirdDownPct: thirdDowns && thirdDownConversions != null ? round(thirdDownConversions / thirdDowns) : null,
        thirdDownDefensePct: opponentThirdDowns && opponentThirdDownConversions != null ? round(opponentThirdDownConversions / opponentThirdDowns) : null,
        turnoverMarginPerGame: gamesPlayed && turnovers != null && takeaways != null ? round((takeaways - turnovers) / gamesPlayed, 2) : null,
        sacksPerGame: gamesPlayed && stat("sacks") != null ? round((stat("sacks") ?? 0) / gamesPlayed, 1) : null,
        offensiveSuccessRate: objectNumber(advanced?.offense, "successRate", "success_rate"),
        defensiveSuccessRate: objectNumber(advanced?.defense, "successRate", "success_rate"),
        offensiveExplosiveness: objectNumber(advanced?.offense, "explosiveness"),
        defensiveExplosiveness: objectNumber(advanced?.defense, "explosiveness"),
        offensivePpa: objectNumber(advanced?.offense, "ppa"),
        defensivePpa: objectNumber(advanced?.defense, "ppa"),
        offensivePointsPerOpportunity: objectNumber(advanced?.offense, "pointsPerOpportunity", "points_per_opportunity"),
        defensivePointsPerOpportunity: objectNumber(advanced?.defense, "pointsPerOpportunity", "points_per_opportunity"),
        defensiveHavoc: nestedNumber(advanced?.defense, "havoc", "total"),
      },
    };
  });
}

export function buildPlayerEntities(
  players: CfbdRosterPlayer[],
  teams: RankableEntity[],
): RankableEntity[] {
  const teamsByName = new Map(teams.map((team) => [team.name, team]));
  const byId = new Map<string, RankableEntity>();
  for (const player of players) {
    const team = teamsByName.get(player.team);
    const hometown = [player.homeCity, player.homeState].filter(Boolean).join(", ");
    byId.set(String(player.id), {
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
    });
  }
  return [...byId.values()];
}

function buildCoachEntities(coaches: CfbdCoach[], teams: RankableEntity[], year: number): RankableEntity[] {
  const teamsByName = new Map(teams.map((team) => [team.name, team]));
  return coaches.map((coach) => {
    const current = coach.seasons.find((season) => season.year === year) ?? [...coach.seasons].sort((a, b) => a.year - b.year).at(-1);
    const careerWins = coach.seasons.reduce((sum, season) => sum + (season.wins ?? 0), 0);
    const careerLosses = coach.seasons.reduce((sum, season) => sum + (season.losses ?? 0), 0);
    const careerTies = coach.seasons.reduce((sum, season) => sum + (season.ties ?? 0), 0);
    const games = careerWins + careerLosses + careerTies;
    const team = current ? teamsByName.get(current.school) : undefined;
    return {
      id: `coach:${coach.id}`,
      externalIds: { cfbd: String(coach.id) },
      entityType: "coach",
      name: `${coach.firstName} ${coach.lastName}`.trim(),
      aliases: current ? [current.school, current.conference ?? ""] : [],
      imageUrl: team?.imageUrl,
      color: team?.color ?? "#364152",
      attributes: {
        team: current?.school ?? "Unattached",
        conference: current?.conference ?? team?.attributes.conference ?? "",
        record: `${careerWins}-${careerLosses}${careerTies ? `-${careerTies}` : ""}`,
        careerWins,
        careerLosses,
        careerWinPct: games ? round((careerWins + careerTies * 0.5) / games) : null,
        currentWins: current?.wins ?? null,
        currentWinPct: current?.winPercentage ?? null,
        srs: current?.srs ?? null,
        spOverall: current?.spOverall ?? null,
        hireDate: coach.hireDate ?? "",
      },
    } satisfies RankableEntity;
  });
}

export function buildDerivedEntities(teams: CfbdTeam[], teamEntities: RankableEntity[], games: CfbdGame[]) {
  const teamsByExternalId = new Map(teamEntities.map((entity) => [entity.externalIds?.cfbd, entity]));
  const mascots: RankableEntity[] = [];
  const stadiums: RankableEntity[] = [];
  const townsByKey = new Map<string, { city: string; state: string; teams: string[]; color: string }>();

  for (const team of teams) {
    const source = teamsByExternalId.get(String(team.id));
    if (team.mascot) mascots.push({ id: `mascot:${team.id}`, entityType: "mascot", name: `${team.school} ${team.mascot}`, shortName: team.mascot, aliases: [team.school, team.mascot], imageUrl: source?.imageUrl, color: source?.color, attributes: { school: team.school, mascot: team.mascot, conference: team.conference ?? "Independent" } });
    if (team.location?.name) stadiums.push({ id: `stadium:${team.location.id ?? team.id}`, externalIds: team.location.id == null ? undefined : { cfbd: String(team.location.id) }, entityType: "stadium", name: team.location.name, aliases: [team.school, team.location.city, team.location.state].filter((value): value is string => Boolean(value)), imageUrl: source?.imageUrl, color: source?.color, attributes: { team: team.school, city: [team.location.city, team.location.state].filter(Boolean).join(", "), capacity: team.location.capacity ?? null, conference: team.conference ?? "Independent" } });
    if (team.location?.city) {
      const key = `${team.location.city}|${team.location.state ?? ""}`;
      const existing = townsByKey.get(key);
      if (existing) existing.teams.push(team.school);
      else townsByKey.set(key, { city: team.location.city, state: team.location.state ?? "", teams: [team.school], color: source?.color ?? "#364152" });
    }
  }

  const towns: RankableEntity[] = [...townsByKey.entries()].map(([key, town]) => ({ id: `town:${slug(key)}`, entityType: "town", name: town.city, shortName: town.state, aliases: [...town.teams, town.state], color: town.color, attributes: { state: town.state, schools: town.teams.join(", "), teamCount: town.teams.length } }));
  const conferenceGroups = Map.groupBy(teamEntities, (entity) => String(entity.attributes.conference || "Independent"));
  const conferences: RankableEntity[] = [...conferenceGroups.entries()].map(([conference, members]) => {
    const numeric = (key: string) => members.map((member) => asNumber(member.attributes[key])).filter((value): value is number => value != null);
    const average = (values: number[]) => values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length, 2) : null;
    return { id: `conference:${slug(conference)}`, entityType: "conference", name: conference, aliases: members.map((member) => member.name), color: members[0]?.color, attributes: { teamCount: members.length, teams: members.map((member) => member.name).join(", "), totalWins: numeric("wins").reduce((sum, value) => sum + value, 0), averageWinPct: average(numeric("winPct")), averageElo: average(numeric("elo")), averageSrs: average(numeric("srs")) } };
  });
  const gameEntities: RankableEntity[] = games.map((game) => {
    const totalPoints = game.homePoints != null && game.awayPoints != null ? game.homePoints + game.awayPoints : null;
    const scoreMargin = game.homePoints != null && game.awayPoints != null ? Math.abs(game.homePoints - game.awayPoints) : null;
    return { id: `game:${game.id}`, externalIds: { cfbd: String(game.id) }, entityType: "game", name: `${game.awayTeam} at ${game.homeTeam}`, aliases: [game.awayTeam, game.homeTeam, game.venue ?? ""], color: teamsByExternalId.get(String(game.homeId))?.color, attributes: { matchup: `${game.awayTeam} at ${game.homeTeam}`, homeTeam: game.homeTeam, awayTeam: game.awayTeam, week: game.week, date: game.startDate ?? "TBD", completed: game.completed, score: game.homePoints == null || game.awayPoints == null ? "Scheduled" : `${game.awayTeam} ${game.awayPoints}, ${game.homeTeam} ${game.homePoints}`, venue: game.venue ?? "", homeConference: game.homeConference ?? "", awayConference: game.awayConference ?? "", conferenceGame: game.conferenceGame ?? false, attendance: game.attendance ?? null, excitementIndex: game.excitementIndex ?? null, totalPoints, scoreMargin } };
  });
  return { mascots, stadiums, towns, conferences, games: gameEntities };
}

function enrichStadiumEntities(stadiums: RankableEntity[], venueRows: FlexibleRow[]): RankableEntity[] {
  const venuesById = new Map(venueRows.map((row) => [pickString(row, "id"), row]));
  const venuesByName = new Map(venueRows.map((row) => [pickString(row, "name"), row]));
  return stadiums.map((stadium) => {
    const row = venuesById.get(stadium.externalIds?.cfbd ?? "") ?? venuesByName.get(stadium.name);
    if (!row) return stadium;
    const city = pickString(row, "city");
    const state = pickString(row, "state");
    return {
      ...stadium,
      aliases: [...new Set([...(stadium.aliases ?? []), city, state].filter(Boolean))],
      attributes: {
        ...stadium.attributes,
        city: [city, state].filter(Boolean).join(", ") || stadium.attributes.city,
        state,
        capacity: pickNumber(row, "capacity") ?? stadium.attributes.capacity,
        constructionYear: pickNumber(row, "constructionYear"),
        latitude: pickNumber(row, "latitude"),
        longitude: pickNumber(row, "longitude"),
        elevation: pickNumber(row, "elevation"),
        dome: typeof row.dome === "boolean" ? row.dome : null,
        grass: typeof row.grass === "boolean" ? row.grass : null,
        timezone: pickString(row, "timezone"),
      },
    };
  });
}

function buildRecruitingClassEntities(
  rows: z.infer<typeof recruitingSchema>[],
  teams: RankableEntity[],
  year: number,
): RankableEntity[] {
  const teamsByName = new Map(teams.map((team) => [team.name, team]));
  return rows.map((row) => {
    const team = teamsByName.get(row.team);
    return {
      id: `recruiting-class:${year}:${slug(row.team)}`,
      entityType: "recruiting-class",
      name: `${row.team} ${year} Recruiting Class`,
      shortName: `#${row.rank}`,
      aliases: [row.team, String(year), `${year} class`],
      imageUrl: team?.imageUrl,
      color: team?.color,
      attributes: {
        team: row.team,
        year,
        conference: team?.attributes.conference ?? "",
        nationalRank: row.rank,
        points: row.points,
      },
    } satisfies RankableEntity;
  });
}

function buildRecruitEntities(rows: FlexibleRow[], teams: RankableEntity[], year: number): RankableEntity[] {
  const teamsByName = new Map(teams.map((team) => [team.name, team]));
  return rows.map((row, index) => {
    const id = pickString(row, "id", "athleteId") || `${year}-${index}-${slug(pickString(row, "name"))}`;
    const name = pickString(row, "name") || `Recruit ${index + 1}`;
    const committedTo = pickString(row, "committedTo", "college");
    const team = teamsByName.get(committedTo);
    const state = pickString(row, "stateProvince", "state");
    return {
      id: `recruit:${id}`,
      externalIds: pickString(row, "id") ? { cfbd: pickString(row, "id") } : undefined,
      entityType: "recruit",
      name,
      shortName: pickString(row, "position") || undefined,
      aliases: [committedTo, pickString(row, "school"), state].filter(Boolean),
      imageUrl: team?.imageUrl,
      color: team?.color,
      attributes: {
        year: pickNumber(row, "year") ?? year,
        recruitType: pickString(row, "recruitType"),
        school: pickString(row, "school"),
        committedTo,
        conference: team?.attributes.conference ?? "",
        position: pickString(row, "position"),
        nationalRank: pickNumber(row, "ranking", "rank"),
        stars: pickNumber(row, "stars"),
        rating: pickNumber(row, "rating"),
        height: pickNumber(row, "height"),
        weight: pickNumber(row, "weight"),
        city: pickString(row, "city"),
        state,
        country: pickString(row, "country"),
      },
    } satisfies RankableEntity;
  });
}

function buildTransferEntities(rows: FlexibleRow[], teams: RankableEntity[], year: number): RankableEntity[] {
  const teamsByName = new Map(teams.map((team) => [team.name, team]));
  return rows.map((row, index) => {
    const name = [pickString(row, "firstName"), pickString(row, "lastName")].filter(Boolean).join(" ") || pickString(row, "name") || `Transfer ${index + 1}`;
    const destination = pickString(row, "destination");
    const origin = pickString(row, "origin");
    const team = teamsByName.get(destination) ?? teamsByName.get(origin);
    const transferDate = pickString(row, "transferDate");
    return {
      id: `transfer:${year}:${slug(name)}:${slug(origin)}:${slug(destination || "open")}`,
      entityType: "transfer",
      name,
      shortName: pickString(row, "position") || undefined,
      aliases: [origin, destination, pickString(row, "position")].filter(Boolean),
      imageUrl: team?.imageUrl,
      color: team?.color,
      attributes: {
        year: pickNumber(row, "season", "year") ?? year,
        position: pickString(row, "position"),
        origin,
        destination: destination || "Uncommitted",
        transferDate,
        rating: pickNumber(row, "rating"),
        stars: pickNumber(row, "stars"),
        eligibility: typeof row.eligibility === "string" ? row.eligibility : row.eligibility ? JSON.stringify(row.eligibility) : "",
      },
    } satisfies RankableEntity;
  });
}

function buildUnitEntities(teams: RankableEntity[]): RankableEntity[] {
  return teams.flatMap((team) => ["Offense", "Defense"].map((side) => {
    const prefix = `advanced:${side.toLowerCase()}:`;
    const attributes = Object.fromEntries(Object.entries(team.attributes).flatMap(([key, value]) => {
      if (key.startsWith(prefix)) return [[key.slice(prefix.length), value]];
      if (side === "Offense" && ["pointsPerGame", "passingYardsPerGame", "rushingYardsPerGame", "totalYardsPerGame", "offensivePpa", "offensiveSuccessRate", "offensiveExplosiveness", "offensivePointsPerOpportunity"].includes(key)) return [[key.replace(/^offensive/, ""), value]];
      if (side === "Defense" && ["pointsAllowedPerGame", "defensivePpa", "defensiveSuccessRate", "defensiveExplosiveness", "defensivePointsPerOpportunity", "defensiveHavoc"].includes(key)) return [[key.replace(/^defensive/, ""), value]];
      return [];
    }));
    return {
      id: `unit:${team.id}:${side.toLowerCase()}`,
      entityType: "unit",
      name: `${team.name} ${side}`,
      shortName: side,
      aliases: [team.name, side, String(team.attributes.conference ?? "")],
      imageUrl: team.imageUrl,
      color: team.color,
      attributes: {
        team: team.name,
        conference: team.attributes.conference ?? "",
        side,
        ...attributes,
      },
    } satisfies RankableEntity;
  }));
}

function buildTeamSeasonEntities(teams: RankableEntity[], year: number): RankableEntity[] {
  return teams.map((team) => ({
    ...team,
    id: `team-season:${team.id}:${year}`,
    externalIds: undefined,
    entityType: "team-season",
    name: `${year} ${team.name}`,
    shortName: team.shortName,
    aliases: [...(team.aliases ?? []), team.name, String(year)],
    attributes: { ...team.attributes, team: team.name, year },
  }));
}

function buildDraftPickEntities(rows: FlexibleRow[], teams: RankableEntity[], year: number): RankableEntity[] {
  const teamsByName = new Map(teams.map((team) => [team.name, team]));
  return rows.map((row, index) => {
    const name = pickString(row, "name") || `Draft pick ${index + 1}`;
    const collegeTeam = pickString(row, "collegeTeam");
    const team = teamsByName.get(collegeTeam);
    const overall = pickNumber(row, "overall");
    return {
      id: `draft-pick:${pickNumber(row, "year") ?? year}:${overall ?? index + 1}`,
      externalIds: pickString(row, "collegeAthleteId") ? { cfbd: pickString(row, "collegeAthleteId") } : undefined,
      entityType: "draft-pick",
      name,
      shortName: overall ? `#${overall}` : pickString(row, "position") || undefined,
      aliases: [collegeTeam, pickString(row, "nflTeam"), pickString(row, "position")].filter(Boolean),
      imageUrl: team?.imageUrl,
      color: team?.color,
      attributes: {
        year: pickNumber(row, "year") ?? year,
        collegeTeam,
        collegeConference: pickString(row, "collegeConference") || team?.attributes.conference || "",
        nflTeam: pickString(row, "nflTeam"),
        position: pickString(row, "position"),
        overall,
        round: pickNumber(row, "round"),
        pick: pickNumber(row, "pick"),
        preDraftRanking: pickNumber(row, "preDraftRanking"),
        preDraftPositionRanking: pickNumber(row, "preDraftPositionRanking"),
        preDraftGrade: pickNumber(row, "preDraftGrade"),
        height: pickNumber(row, "height"),
        weight: pickNumber(row, "weight"),
      },
    } satisfies RankableEntity;
  });
}

export async function pullCollegeFootballSnapshot(year: number): Promise<CollegeFootballSnapshot> {
  const [
    teams, records, games, roster, coaches, teamStats, advanced, elo, srs, polls,
    recruiting, talent, returning, venues, recruits, transfers, sp, fpi, draftPicks,
  ] = await Promise.all([
    fetchCfbd("/teams/fbs", { year }, z.array(teamSchema)),
    fetchCfbd("/records", { year }, z.array(recordSchema)),
    fetchCfbd("/games", { year, seasonType: "regular", classification: "fbs" }, z.array(gameSchema)),
    optionalFeed("Player rosters", fetchCfbd("/roster", { year, classification: "fbs" }, z.array(rosterPlayerSchema)), [] as CfbdRosterPlayer[]),
    optionalFeed("Coach records", fetchCfbd("/coaches", { year }, z.array(coachSchema)), [] as CfbdCoach[]),
    optionalFeed("Team season statistics", fetchCfbd("/stats/season", { year, classification: "fbs" }, z.array(teamStatSchema)), [] as CfbdTeamStat[]),
    optionalFeed("Advanced team statistics", fetchCfbd("/stats/season/advanced", { year, classification: "fbs" }, z.array(advancedSeasonStatSchema)), [] as CfbdAdvancedSeasonStat[]),
    optionalFeed("Elo ratings", fetchCfbd("/ratings/elo", { year }, z.array(teamEloSchema)), [] as z.infer<typeof teamEloSchema>[]),
    optionalFeed("SRS ratings", fetchCfbd("/ratings/srs", { year }, z.array(teamSrsSchema)), [] as z.infer<typeof teamSrsSchema>[]),
    optionalFeed("Official polls", fetchCfbd("/rankings", { year }, z.array(pollWeekSchema)), [] as z.infer<typeof pollWeekSchema>[]),
    optionalFeed("Recruiting rankings", fetchCfbd("/recruiting/teams", { year }, z.array(recruitingSchema)), [] as z.infer<typeof recruitingSchema>[]),
    optionalFeed("Team talent ratings", fetchCfbd("/talent", { year }, z.array(talentSchema)), [] as z.infer<typeof talentSchema>[]),
    optionalFeed("Returning production", fetchCfbd("/player/returning", { year }, z.array(returningSchema)), [] as z.infer<typeof returningSchema>[]),
    optionalFeed("Venue details", fetchCfbd("/venues", {}, flexibleRowsSchema), [] as FlexibleRow[]),
    optionalFeed("Individual recruits", fetchCfbd("/recruiting/players", { year }, flexibleRowsSchema), [] as FlexibleRow[]),
    optionalFeed("Transfer portal", fetchCfbd("/player/portal", { year }, flexibleRowsSchema), [] as FlexibleRow[]),
    optionalFeed("SP ratings", fetchCfbd("/ratings/sp", { year }, flexibleRowsSchema), [] as FlexibleRow[]),
    optionalFeed("FPI ratings", fetchCfbd("/ratings/fpi", { year }, flexibleRowsSchema), [] as FlexibleRow[]),
    optionalFeed("NFL draft picks", fetchCfbd("/draft/picks", { year }, flexibleRowsSchema), [] as FlexibleRow[]),
  ]);

  const baseTeams = buildTeamEntities(teams, records, games);
  const teamEntities = enrichTeamEntities(
    baseTeams,
    teamStats.data,
    advanced.data,
    elo.data,
    srs.data,
    polls.data,
    recruiting.data,
    talent.data,
    returning.data,
    sp.data,
    fpi.data,
  );
  const derived = buildDerivedEntities(teams, teamEntities, games);
  const playerEntities = buildPlayerEntities(roster.data, teamEntities);
  const stadiumEntities = enrichStadiumEntities(derived.stadiums, venues.data);
  const recruitingClasses = buildRecruitingClassEntities(recruiting.data, teamEntities, year);
  const recruitEntities = buildRecruitEntities(recruits.data, teamEntities, year);
  const transferEntities = buildTransferEntities(transfers.data, teamEntities, year);
  const unitEntities = buildUnitEntities(teamEntities);
  const teamSeasonEntities = buildTeamSeasonEntities(teamEntities, year);
  const draftPickEntities = buildDraftPickEntities(draftPicks.data, teamEntities, year);
  const refreshedAt = new Date().toISOString();
  const warnings = [
    roster, coaches, teamStats, advanced, elo, srs, polls, recruiting, talent, returning,
    venues, recruits, transfers, sp, fpi, draftPicks,
  ].flatMap((feed) => feed.warning ? [feed.warning] : []);
  return {
    year,
    id: `college-football-${year}`,
    version: `cfbd-${year}-${refreshedAt}`,
    sourceLabel: "CollegeFootballData relational snapshot",
    refreshedAt,
    connected: true,
    upstreamRequests: 19,
    warnings,
    teams: teamEntities,
    players: playerEntities,
    coaches: buildCoachEntities(coaches.data, teamEntities, year),
    conferences: derived.conferences,
    games: derived.games,
    mascots: derived.mascots,
    towns: derived.towns,
    stadiums: stadiumEntities,
    recruitingClasses,
    recruits: recruitEntities,
    transfers: transferEntities,
    units: unitEntities,
    teamSeasons: teamSeasonEntities,
    draftPicks: draftPickEntities,
    metricsByEntityType: {
      team: mergeMetricDefinitions(TEAM_METRICS, metricDefinitionsFromEntities(teamEntities, "CFBD team metrics", "Efficiency")),
      player: metricDefinitionsFromEntities(playerEntities, "CFBD roster", "Roster"),
      coach: COACH_METRICS,
      conference: CONFERENCE_METRICS,
      game: GAME_METRICS,
      stadium: metricDefinitionsFromEntities(stadiumEntities, "CFBD venues", "Physical"),
      town: metricDefinitionsFromEntities(derived.towns, "CFBD team locations", "Other"),
      mascot: [],
      "recruiting-class": metricDefinitionsFromEntities(recruitingClasses, "CFBD team recruiting", "Roster"),
      recruit: metricDefinitionsFromEntities(recruitEntities, "CFBD recruits", "Roster"),
      transfer: metricDefinitionsFromEntities(transferEntities, "CFBD transfer portal", "Roster"),
      unit: metricDefinitionsFromEntities(unitEntities, "CFBD unit metrics", "Efficiency"),
      "team-season": mergeMetricDefinitions(TEAM_METRICS, metricDefinitionsFromEntities(teamSeasonEntities, "CFBD season snapshots", "History")),
      "draft-pick": metricDefinitionsFromEntities(draftPickEntities, "CFBD NFL draft", "History"),
    },
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
    metricDefinitions: snapshot.metricsByEntityType.team,
    entities: snapshot.teams,
  };
}
