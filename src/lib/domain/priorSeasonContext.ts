import type { DatasetEnvelope, MetricDefinition, RankableEntity } from "./types";

const PRIOR_METRICS: Record<string, string[]> = {
  team: ["wins", "losses", "winPct", "averageMargin", "pointsPerGame", "pointsAllowedPerGame", "strengthOfSchedule", "roadWins", "recentMargin", "apRank", "elo", "srs", "spOverall", "spOffense", "spDefense", "fpi", "talent", "returningProduction", "fpi:resumeRanks:strengthOfRecord"],
  coach: ["currentWins", "currentWinPct", "srs", "spOverall"],
  player: ["stat:passing:yds", "stat:passing:td", "stat:passing:pct", "stat:passing:int", "stat:rushing:yds", "stat:rushing:td", "stat:rushing:ypc", "stat:receiving:rec", "stat:receiving:yds", "stat:receiving:td", "stat:defensive:tot", "stat:defensive:sacks", "stat:defensive:tfl", "stat:interceptions:int", "stat:kicking:fgm", "stat:kicking:pct", "ppa:averagePPA:all", "usage:usage:overall"],
  "team-season": ["wins", "losses", "winPct", "strengthOfSchedule", "apRank", "elo", "srs", "spOverall", "spOffense", "spDefense", "fpi", "talent"],
};

function earlySeason(entityType: string, entities: RankableEntity[]): boolean {
  if (entityType !== "team" && entityType !== "team-season") return true;
  const games = entities.flatMap((entity) => typeof entity.attributes.gamesPlayed === "number" ? [entity.attributes.gamesPlayed] : []);
  return !games.length || Math.max(...games) <= 2;
}

export function mergePriorSeasonContext(current: DatasetEnvelope, previous: DatasetEnvelope | null, season: number): DatasetEnvelope {
  const entityType = current.entities[0]?.entityType;
  const keys = entityType ? PRIOR_METRICS[entityType] ?? [] : [];
  if (!previous?.entities.length || !entityType || !keys.length || !earlySeason(entityType, current.entities)) return current;
  const previousById = new Map(previous.entities.map((entity) => [entity.id, entity]));
  const priorDefinitions = new Map((previous.metricDefinitions ?? []).map((metric) => [metric.key, metric]));
  const availableKeys = keys.filter((key) => priorDefinitions.has(key) && current.entities.some((entity) => typeof previousById.get(entity.id)?.attributes[key] === "number"));
  if (!availableKeys.length) return current;

  const entities = current.entities.map((entity) => {
    const prior = previousById.get(entity.id);
    if (!prior) return entity;
    return {
      ...entity,
      attributes: {
        ...entity.attributes,
        ...Object.fromEntries(availableKeys.flatMap((key) => {
          const value = prior.attributes[key];
          return typeof value === "number" && Number.isFinite(value) ? [[`prior:${season - 1}:${key}`, value]] : [];
        })),
      },
    };
  });
  const metrics = availableKeys.flatMap<MetricDefinition>((key) => {
    const metric = priorDefinitions.get(key);
    if (!metric) return [];
    return [{
      ...metric,
      key: `prior:${season - 1}:${key}`,
      label: `${season - 1} ${metric.label}`,
      description: `${metric.description} Shown as clearly labeled prior-season context.`,
      group: "History",
      tier: "advanced",
      season: season - 1,
      context: "prior-season",
      source: metric.source ? `${metric.source} · prior season` : "Prior season",
    }];
  });
  return { ...current, entities, metricDefinitions: [...(current.metricDefinitions ?? []), ...metrics] };
}
