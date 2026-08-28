import { metricDesirability } from "./metrics";

export type TeamStrengthValue = {
  entityId: string;
  key: string;
  value: number;
};

export type TeamStrengthProfile = {
  score: number;
  rank: number;
  fieldSize: number;
  label: "Elite" | "Tough" | "Even" | "Favorable" | "Easier";
  primaryMetric: string | null;
  primaryValue: number | null;
};

const METRICS = [
  { key: "fpi", direction: "desc" as const, weight: 1.2, label: "FPI" },
  { key: "spOverall", direction: "desc" as const, weight: 1.2, label: "SP+" },
  { key: "elo", direction: "desc" as const, weight: 1, label: "Elo" },
  { key: "srs", direction: "desc" as const, weight: 1, label: "SRS" },
  { key: "apRank", direction: "asc" as const, weight: 1, label: "AP rank" },
  { key: "winPct", direction: "desc" as const, weight: 0.8, label: "Win %" },
];

export const TEAM_STRENGTH_KEYS = METRICS.map((metric) => metric.key);

function strengthLabel(score: number): TeamStrengthProfile["label"] {
  if (score >= 0.82) return "Elite";
  if (score >= 0.65) return "Tough";
  if (score >= 0.4) return "Even";
  if (score >= 0.2) return "Favorable";
  return "Easier";
}

export function buildTeamStrengthIndex(values: TeamStrengthValue[]): Map<string, TeamStrengthProfile> {
  const populationByKey = new Map(METRICS.map((metric) => [metric.key, values.filter((value) => value.key === metric.key).map((value) => value.value)]));
  const valuesByEntity = new Map<string, TeamStrengthValue[]>();
  for (const value of values) valuesByEntity.set(value.entityId, [...(valuesByEntity.get(value.entityId) ?? []), value]);

  const scored = [...valuesByEntity.entries()].flatMap(([entityId, entityValues]) => {
    let weightedScore = 0;
    let totalWeight = 0;
    for (const metric of METRICS) {
      const match = entityValues.find((value) => value.key === metric.key);
      const population = populationByKey.get(metric.key) ?? [];
      if (!match || population.length < 2) continue;
      const desirability = metricDesirability(match.value, population, metric.direction);
      if (desirability === null) continue;
      weightedScore += desirability * metric.weight;
      totalWeight += metric.weight;
    }
    if (!totalWeight) return [];
    const primary = METRICS.flatMap((metric) => {
      const match = entityValues.find((value) => value.key === metric.key);
      return match ? [{ label: metric.label, value: match.value }] : [];
    })[0] ?? null;
    return [{ entityId, score: weightedScore / totalWeight, primary }];
  }).sort((left, right) => right.score - left.score || left.entityId.localeCompare(right.entityId));

  return new Map(scored.map((team, index) => [team.entityId, {
    score: team.score,
    rank: index + 1,
    fieldSize: scored.length,
    label: strengthLabel(team.score),
    primaryMetric: team.primary?.label ?? null,
    primaryValue: team.primary?.value ?? null,
  }]));
}

export function signatureResults<T extends { result: "W" | "L" | "T" | null; difficultyScore: number | null }>(games: T[]): { bestWin: T | null; worstLoss: T | null } {
  const bestWin = games.filter((game) => game.result === "W" && game.difficultyScore !== null).sort((left, right) => (right.difficultyScore ?? -1) - (left.difficultyScore ?? -1))[0] ?? null;
  const worstLoss = games.filter((game) => game.result === "L" && game.difficultyScore !== null).sort((left, right) => (left.difficultyScore ?? 2) - (right.difficultyScore ?? 2))[0] ?? null;
  return { bestWin, worstLoss };
}
