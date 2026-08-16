import type { MetricDefinition, RankableEntity } from "./types";

type MetricOverride = Partial<Pick<MetricDefinition, "label" | "description" | "format" | "direction" | "group" | "source" | "unitLabel">>;

type EntityMetricCatalog = {
  coreMetricKeys: string[];
  overrides: Record<string, MetricOverride>;
};

const TEAM_OVERRIDES: Record<string, MetricOverride> = {
  wins: { label: "Wins", description: "Total wins in the selected season.", format: "integer", direction: "desc", group: "Resume" },
  losses: { label: "Losses", description: "Total losses in the selected season. Lower is better.", format: "integer", direction: "asc", group: "Resume" },
  gamesPlayed: { label: "Games played", description: "Completed games in the selected season.", format: "integer", direction: "desc", group: "Resume" },
  winPct: { label: "Win percentage", description: "Wins plus half of ties divided by games played.", format: "percentage", direction: "desc", group: "Resume" },
  averageMargin: { label: "Average margin", description: "Average scoring margin in completed games.", format: "signed", direction: "desc", group: "Scoring" },
  pointsPerGame: { label: "Points per game", description: "Average points scored in completed games.", format: "decimal", direction: "desc", group: "Scoring" },
  pointsAllowedPerGame: { label: "Points allowed", description: "Average points allowed in completed games. Lower is better.", format: "decimal", direction: "asc", group: "Scoring" },
  strengthOfSchedule: { label: "Strength of schedule", description: "Combined win percentage of scheduled opponents.", format: "percentage", direction: "desc", group: "Resume" },
  apRank: { label: "AP rank", description: "Latest AP poll position in the selected snapshot. Lower is better.", format: "integer", direction: "asc", group: "Resume" },
  elo: { label: "Elo rating", description: "Opponent-adjusted Elo strength rating.", format: "integer", direction: "desc", group: "Power" },
  srs: { label: "SRS rating", description: "Simple Rating System strength estimate.", format: "signed", direction: "desc", group: "Power" },
  spOverall: { label: "SP+ overall", description: "Opponent-adjusted overall SP+ rating.", format: "signed", direction: "desc", group: "Power" },
  spOffense: { label: "SP+ offense", description: "Opponent-adjusted offensive SP+ rating.", format: "signed", direction: "desc", group: "Power" },
  spDefense: { label: "SP+ defense", description: "Opponent-adjusted defensive SP+ rating. Lower is better.", format: "signed", direction: "asc", group: "Power" },
  fpi: { label: "FPI", description: "Football Power Index team strength rating.", format: "signed", direction: "desc", group: "Power" },
  talent: { label: "Team talent", description: "Roster talent composite from recruiting ratings.", format: "decimal", direction: "desc", group: "Roster" },
  recruitingRank: { label: "Recruiting rank", description: "Team recruiting class rank for the selected year. Lower is better.", format: "integer", direction: "asc", group: "Roster" },
  recruitingPoints: { label: "Recruiting points", description: "Composite points for the selected recruiting class.", format: "decimal", direction: "desc", group: "Roster" },
  returningProduction: { label: "Returning production", description: "Share of prior production returning to the roster.", format: "percentage", direction: "desc", group: "Roster" },
  passingYardsPerGame: { label: "Pass yards / game", description: "Net passing yards divided by games played.", format: "decimal", direction: "desc", group: "Production" },
  rushingYardsPerGame: { label: "Rush yards / game", description: "Rushing yards divided by games played.", format: "decimal", direction: "desc", group: "Production" },
  totalYardsPerGame: { label: "Total yards / game", description: "Total offense divided by games played.", format: "decimal", direction: "desc", group: "Production" },
  offensiveSuccessRate: { label: "Offensive success rate", description: "Share of offensive plays considered successful.", format: "percentage", direction: "desc", group: "Efficiency" },
  defensiveSuccessRate: { label: "Defensive success rate allowed", description: "Opponent successful-play rate. Lower is better.", format: "percentage", direction: "asc", group: "Efficiency" },
  offensiveExplosiveness: { label: "Offensive explosiveness", description: "Efficiency of successful offensive plays.", format: "decimal", direction: "desc", group: "Efficiency" },
  defensiveExplosiveness: { label: "Explosiveness allowed", description: "Opponent explosiveness. Lower is better.", format: "decimal", direction: "asc", group: "Efficiency" },
  offensivePpa: { label: "Offensive PPA", description: "Predicted points added per offensive play.", format: "signed", direction: "desc", group: "Efficiency" },
  defensivePpa: { label: "Defensive PPA allowed", description: "Opponent predicted points added per play. Lower is better.", format: "signed", direction: "asc", group: "Efficiency" },
  offensivePointsPerOpportunity: { label: "Points / opportunity", description: "Points scored per scoring opportunity.", format: "decimal", direction: "desc", group: "Efficiency" },
  defensivePointsPerOpportunity: { label: "Points allowed / opportunity", description: "Opponent points per scoring opportunity. Lower is better.", format: "decimal", direction: "asc", group: "Efficiency" },
  defensiveHavoc: { label: "Defensive havoc", description: "Rate of disruptive defensive plays.", format: "percentage", direction: "desc", group: "Efficiency" },
  "fpi:resumeRanks:strengthOfRecord": { label: "Strength of record", description: "FPI strength-of-record rank. Lower is better.", format: "integer", direction: "asc", group: "Resume", source: "CFBD FPI" },
  "fpi:resumeRanks:strengthOfSchedule": { label: "FPI SOS rank", description: "FPI strength-of-schedule rank. Lower is harder.", format: "integer", direction: "asc", group: "Resume", source: "CFBD FPI" },
  "fpi:resumeRanks:remainingStrengthOfSchedule": { label: "Remaining SOS rank", description: "FPI remaining strength-of-schedule rank. Lower is harder.", format: "integer", direction: "asc", group: "Resume", source: "CFBD FPI" },
  "fpi:resumeRanks:gameControl": { label: "Game control rank", description: "FPI game-control rank. Lower is better.", format: "integer", direction: "asc", group: "Resume", source: "CFBD FPI" },
  "fpi:efficiencies:offense": { label: "FPI offense", description: "FPI offensive efficiency rating.", format: "decimal", direction: "desc", group: "Power", source: "CFBD FPI" },
  "fpi:efficiencies:defense": { label: "FPI defense", description: "FPI defensive efficiency rating.", format: "decimal", direction: "desc", group: "Power", source: "CFBD FPI" },
  "fpi:efficiencies:specialTeams": { label: "FPI special teams", description: "FPI special-teams efficiency rating.", format: "decimal", direction: "desc", group: "Power", source: "CFBD FPI" },
  "sp:specialTeams:rating": { label: "SP+ special teams", description: "Opponent-adjusted special-teams SP+ rating.", format: "signed", direction: "desc", group: "Power", source: "CFBD SP+" },
};

const ENTITY_METRIC_CATALOG: Record<string, EntityMetricCatalog> = {
  team: {
    coreMetricKeys: ["fpi", "spOverall", "strengthOfRecordRank", "fpi:resumeRanks:strengthOfRecord", "strengthOfSchedule", "fpi:resumeRanks:strengthOfSchedule", "remainingSosRank", "fpi:resumeRanks:remainingStrengthOfSchedule", "spOffense", "spDefense", "talent", "apRank", "wins", "winPct", "roadWins", "recentMargin", "pointsPerGame", "pointsAllowedPerGame", "yardsPerPlay", "yardsAllowedPerPlay", "turnoverMarginPerGame", "returningProduction"],
    overrides: TEAM_OVERRIDES,
  },
  "team-season": {
    coreMetricKeys: ["wins", "winPct", "strengthOfSchedule", "apRank", "fpi", "spOverall", "spOffense", "spDefense", "talent"],
    overrides: TEAM_OVERRIDES,
  },
  stadium: {
    coreMetricKeys: ["capacity", "constructionYear", "elevation"],
    overrides: {
      capacity: { label: "Capacity", description: "Official listed venue capacity.", format: "integer", direction: "desc", group: "Physical" },
      constructionYear: { label: "Year opened", description: "Year the venue was constructed.", format: "integer", direction: "desc", group: "Physical" },
      elevation: { label: "Elevation", description: "Venue elevation above sea level.", format: "decimal", direction: "desc", group: "Physical" },
      latitude: { label: "Latitude", description: "Venue latitude.", format: "decimal", direction: "desc", group: "Physical" },
      longitude: { label: "Longitude", description: "Venue longitude.", format: "decimal", direction: "desc", group: "Physical" },
    },
  },
  player: {
    coreMetricKeys: ["stat:passing:yds", "stat:passing:td", "stat:passing:pct", "stat:rushing:yds", "stat:rushing:td", "stat:rushing:ypc", "stat:receiving:rec", "stat:receiving:yds", "stat:receiving:td", "stat:defensive:tot", "stat:defensive:sacks", "stat:defensive:tfl", "stat:interceptions:int", "ppa:averagePPA:all", "usage:usage:overall", "classYear", "height", "weight"],
    overrides: {
      "stat:passing:yds": { label: "Pass yards", description: "Total passing yards in the selected season.", format: "integer", direction: "desc", group: "Production", unitLabel: "yards" },
      "stat:passing:td": { label: "Pass TD", description: "Passing touchdowns in the selected season.", format: "integer", direction: "desc", group: "Production", unitLabel: "touchdowns" },
      "stat:passing:pct": { label: "Completion %", description: "Share of pass attempts completed.", format: "percentage", direction: "desc", group: "Efficiency", unitLabel: "percent" },
      "stat:passing:int": { label: "Interceptions thrown", description: "Passes intercepted by the defense. Lower is better.", format: "integer", direction: "asc", group: "Efficiency", unitLabel: "interceptions" },
      "stat:rushing:yds": { label: "Rush yards", description: "Total rushing yards in the selected season.", format: "integer", direction: "desc", group: "Production", unitLabel: "yards" },
      "stat:rushing:td": { label: "Rush TD", description: "Rushing touchdowns in the selected season.", format: "integer", direction: "desc", group: "Production", unitLabel: "touchdowns" },
      "stat:rushing:ypc": { label: "Yards / carry", description: "Average rushing yards per carry.", format: "decimal", direction: "desc", group: "Efficiency", unitLabel: "yards per carry" },
      "stat:receiving:rec": { label: "Receptions", description: "Completed passes caught in the selected season.", format: "integer", direction: "desc", group: "Production", unitLabel: "receptions" },
      "stat:receiving:yds": { label: "Receiving yards", description: "Total receiving yards in the selected season.", format: "integer", direction: "desc", group: "Production", unitLabel: "yards" },
      "stat:receiving:td": { label: "Receiving TD", description: "Receiving touchdowns in the selected season.", format: "integer", direction: "desc", group: "Production", unitLabel: "touchdowns" },
      "stat:defensive:tot": { label: "Total tackles", description: "Total credited tackles in the selected season.", format: "integer", direction: "desc", group: "Production", unitLabel: "tackles" },
      "stat:defensive:sacks": { label: "Sacks", description: "Credited quarterback sacks in the selected season.", format: "decimal", direction: "desc", group: "Production", unitLabel: "sacks" },
      "stat:defensive:tfl": { label: "Tackles for loss", description: "Credited tackles behind the line of scrimmage.", format: "decimal", direction: "desc", group: "Production", unitLabel: "tackles" },
      "stat:interceptions:int": { label: "Defensive interceptions", description: "Passes intercepted on defense.", format: "integer", direction: "desc", group: "Production", unitLabel: "interceptions" },
      "ppa:averagePPA:all": { label: "Average PPA", description: "Average predicted points added when the player is involved.", format: "decimal", direction: "desc", group: "Efficiency", source: "CFBD PPA" },
      "usage:usage:overall": { label: "Usage share", description: "Share of team plays involving the player.", format: "percentage", direction: "desc", group: "Efficiency", unitLabel: "percent" },
      classYear: { label: "Class year", description: "Roster class year.", format: "integer", direction: "desc", group: "Roster" },
      height: { label: "Height", description: "Listed player height in inches.", format: "integer", direction: "desc", group: "Physical" },
      weight: { label: "Weight", description: "Listed player weight in pounds.", format: "integer", direction: "desc", group: "Physical" },
    },
  },
  coach: {
    coreMetricKeys: ["spOverall", "currentWins", "careerWins", "careerWinPct"],
    overrides: {
      spOverall: TEAM_OVERRIDES.spOverall,
      currentWins: { label: "Current-season wins", description: "Wins in the selected season.", format: "integer", direction: "desc", group: "Resume" },
      careerWins: { label: "Career wins", description: "Attributed head-coaching wins.", format: "integer", direction: "desc", group: "Resume" },
      careerLosses: { label: "Career losses", description: "Attributed head-coaching losses. Lower is better.", format: "integer", direction: "asc", group: "Resume" },
      careerWinPct: { label: "Career win %", description: "Career wins divided by attributed games.", format: "percentage", direction: "desc", group: "Resume" },
    },
  },
  conference: {
    coreMetricKeys: ["averageElo", "averageSrs", "averageWinPct", "totalWins", "teamCount"],
    overrides: {
      averageElo: { label: "Average Elo", description: "Average Elo of member teams with available ratings.", format: "integer", direction: "desc", group: "Power" },
      averageSrs: { label: "Average SRS", description: "Average SRS of member teams with available ratings.", format: "signed", direction: "desc", group: "Power" },
      averageWinPct: { label: "Average win %", description: "Average member-team win percentage.", format: "percentage", direction: "desc", group: "Resume" },
      totalWins: { label: "Total wins", description: "Combined wins for member teams.", format: "integer", direction: "desc", group: "Resume" },
      teamCount: { label: "FBS teams", description: "Number of teams in the selected dataset.", format: "integer", direction: "desc", group: "Other" },
    },
  },
  town: {
    coreMetricKeys: ["teamCount"],
    overrides: {
      teamCount: { label: "Team count", description: "Number of FBS teams connected to this town.", format: "integer", direction: "desc", group: "Other" },
    },
  },
  game: {
    coreMetricKeys: ["excitementIndex", "attendance", "week"],
    overrides: {
      excitementIndex: { label: "Excitement index", description: "CFBD game excitement measure.", format: "decimal", direction: "desc", group: "Other" },
      attendance: { label: "Attendance", description: "Reported game attendance.", format: "integer", direction: "desc", group: "Other" },
      week: { label: "Week", description: "Scheduled season week.", format: "integer", direction: "desc", group: "Other" },
    },
  },
  "recruiting-class": {
    coreMetricKeys: ["nationalRank", "points", "year"],
    overrides: {
      nationalRank: { label: "National rank", description: "National recruiting class rank. Lower is better.", format: "integer", direction: "asc", group: "Roster" },
      points: { label: "Composite points", description: "Recruiting class composite points.", format: "decimal", direction: "desc", group: "Roster" },
      year: { label: "Class year", description: "Recruiting class season.", format: "integer", direction: "desc", group: "History" },
    },
  },
  recruit: {
    coreMetricKeys: ["rating", "stars", "nationalRank", "positionRank"],
    overrides: {
      rating: { label: "Rating", description: "Provider recruiting rating.", format: "decimal", direction: "desc", group: "Roster" },
      stars: { label: "Stars", description: "Provider star rating.", format: "integer", direction: "desc", group: "Roster" },
      nationalRank: { label: "National rank", description: "National prospect rank. Lower is better.", format: "integer", direction: "asc", group: "Roster" },
      positionRank: { label: "Position rank", description: "Prospect rank at the listed position. Lower is better.", format: "integer", direction: "asc", group: "Roster" },
    },
  },
  transfer: {
    coreMetricKeys: ["rating", "stars", "year"],
    overrides: {
      rating: { label: "Rating", description: "Provider transfer rating.", format: "decimal", direction: "desc", group: "Roster" },
      stars: { label: "Stars", description: "Provider star rating.", format: "integer", direction: "desc", group: "Roster" },
      year: { label: "Season", description: "Transfer portal season.", format: "integer", direction: "desc", group: "History" },
    },
  },
  unit: {
    coreMetricKeys: ["pointsPerGame", "pointsAllowedPerGame", "Ppa", "SuccessRate", "Explosiveness", "PointsPerOpportunity", "Havoc"],
    overrides: {},
  },
  "draft-pick": {
    coreMetricKeys: ["overall", "round", "pick", "preDraftGrade", "preDraftRanking"],
    overrides: {
      overall: { label: "Overall pick", description: "Overall NFL Draft selection. Lower is better.", format: "integer", direction: "asc", group: "History" },
      round: { label: "Round", description: "NFL Draft round. Lower is better.", format: "integer", direction: "asc", group: "History" },
      pick: { label: "Pick in round", description: "Selection within the draft round. Lower is better.", format: "integer", direction: "asc", group: "History" },
      preDraftGrade: { label: "Pre-draft grade", description: "Provider pre-draft grade.", format: "decimal", direction: "desc", group: "History" },
      preDraftRanking: { label: "Pre-draft rank", description: "Provider pre-draft ranking. Lower is better.", format: "integer", direction: "asc", group: "History" },
    },
  },
};

const GROUP_ORDER = ["Resume", "Power", "Scoring", "Production", "Efficiency", "Roster", "Physical", "History", "Other"];

function numericValues(entities: RankableEntity[], key: string): number[] {
  return entities.flatMap((entity) => {
    const value = entity.attributes[key];
    return typeof value === "number" && Number.isFinite(value) ? [value] : [];
  });
}

export function metricCatalogConfig(entityType: string): EntityMetricCatalog {
  return ENTITY_METRIC_CATALOG[entityType] ?? { coreMetricKeys: [], overrides: {} };
}

export function curateMetricDefinitions(
  entityType: string,
  definitions: MetricDefinition[],
  entities: RankableEntity[],
): MetricDefinition[] {
  const config = metricCatalogConfig(entityType);
  const coreOrder = new Map(config.coreMetricKeys.map((key, index) => [key, index]));
  const deduped = new Map(definitions.map((definition) => [definition.key, definition]));

  return [...deduped.values()].flatMap((definition) => {
    const values = numericValues(entities, definition.key);
    const populatedEntityCount = values.length;
    const distinctValueCount = new Set(values).size;
    if (!populatedEntityCount || distinctValueCount < 2) return [];
    const override = config.overrides[definition.key] ?? {};
    return [{
      ...definition,
      ...override,
      entityType,
      tier: coreOrder.has(definition.key) ? "core" as const : "advanced" as const,
      populatedEntityCount,
      eligibleEntityCount: entities.length,
      coverage: entities.length ? populatedEntityCount / entities.length : 0,
      distinctValueCount,
      available: true,
      comparative: true,
    }];
  }).sort((left, right) => {
    const leftCore = coreOrder.get(left.key);
    const rightCore = coreOrder.get(right.key);
    if (leftCore != null || rightCore != null) {
      if (leftCore == null) return 1;
      if (rightCore == null) return -1;
      return leftCore - rightCore;
    }
    const groupDifference = GROUP_ORDER.indexOf(left.group ?? "Other") - GROUP_ORDER.indexOf(right.group ?? "Other");
    return groupDifference || left.label.localeCompare(right.label);
  });
}
