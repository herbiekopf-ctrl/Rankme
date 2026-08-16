import type { CustomMetricFormula, MetricDefinition, RankableEntity, UserCustomMetric } from "./types";

export type MetricRank = { entity: RankableEntity; rank: number; value: number | null };
export type MetricHeatBand = "strong" | "above-average" | "neutral" | "below-average" | "weak" | "missing";

export type MetricHeatPresentation = {
  score: number | null;
  band: MetricHeatBand;
  label: string;
  background: string;
  border: string;
  foreground: string;
};

export function numericMetric(entity: RankableEntity, key: string): number | null {
  const value = entity.attributes[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function rankByMetric(entities: RankableEntity[], metric: MetricDefinition): MetricRank[] {
  const sorted = entities
    .map((entity) => ({ entity, value: numericMetric(entity, metric.key) }))
    .sort((a, b) => {
      if (a.value == null && b.value == null) return a.entity.name.localeCompare(b.entity.name);
      if (a.value == null) return 1;
      if (b.value == null) return -1;
      const difference = metric.direction === "asc" ? a.value - b.value : b.value - a.value;
      return difference || a.entity.name.localeCompare(b.entity.name);
    });

  let lastValue: number | null | undefined;
  let lastRank = 0;
  return sorted.map((item, index) => {
    if (item.value == null) return { ...item, rank: 0 };
    if (item.value !== lastValue) lastRank = index + 1;
    lastValue = item.value;
    return { ...item, rank: lastRank };
  });
}

export function metricRanksByEntity(entities: RankableEntity[], metric: MetricDefinition): Map<string, MetricRank> {
  return new Map(rankByMetric(entities, metric).map((item) => [item.entity.id, item]));
}

export function metricHeatPresentation(score: number | null): MetricHeatPresentation {
  if (score == null) {
    return { score, band: "missing", label: "No data", background: "#f2f1ec", border: "#deddd7", foreground: "#6f7772" };
  }
  const normalized = Math.max(0, Math.min(1, score));
  if (normalized >= 0.82) return { score: normalized, band: "strong", label: "Strong", background: "#cae8d6", border: "#80bd98", foreground: "#123f2b" };
  if (normalized >= 0.62) return { score: normalized, band: "above-average", label: "Above avg.", background: "#e0eee4", border: "#add0b8", foreground: "#24553b" };
  if (normalized >= 0.38) return { score: normalized, band: "neutral", label: "Middle", background: "#efeee8", border: "#d8d5ca", foreground: "#4e5751" };
  if (normalized >= 0.18) return { score: normalized, band: "below-average", label: "Below avg.", background: "#f1dfdc", border: "#dab4ae", foreground: "#713a34" };
  return { score: normalized, band: "weak", label: "Weak", background: "#eccbc6", border: "#cc8e86", foreground: "#6a2d28" };
}

export function rankDifference(myRank: number | null, comparisonRank: number): { amount: number | null; label: string; tone: "positive" | "negative" | "neutral" } {
  if (myRank == null || myRank <= 0) return { amount: null, label: "Not in your ranking", tone: "neutral" };
  const amount = myRank - comparisonRank;
  if (amount > 0) return { amount, label: `↑${amount}`, tone: "positive" };
  if (amount < 0) return { amount, label: `↓${Math.abs(amount)}`, tone: "negative" };
  return { amount: 0, label: "Same", tone: "neutral" };
}

export function formatMetricValue(value: number | null, metric: MetricDefinition): string {
  if (value == null) return "Not yet available";
  if (metric.format === "percentage") return `${(value * 100).toFixed(1)}%`;
  if (metric.format === "signed") return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
  if (metric.format === "decimal") return value.toFixed(1);
  return Math.round(value).toLocaleString("en-US");
}

function percentile(values: number[], value: number): number {
  if (values.length < 2) return 0.5;
  let below = 0;
  let equal = 0;
  for (const candidate of values) {
    if (candidate < value) below += 1;
    else if (candidate === value) equal += 1;
  }
  return (below + Math.max(0, equal - 1) / 2) / (values.length - 1);
}

export function metricDesirability(
  value: number | null,
  population: number[],
  direction: MetricDefinition["direction"],
): number | null {
  if (value == null || !population.length) return null;
  const score = percentile(population, value);
  return direction === "asc" ? 1 - score : score;
}

export function metricPopulation(entities: RankableEntity[], key: string): number[] {
  return entities.flatMap((entity) => {
    const value = numericMetric(entity, key);
    return value == null ? [] : [value];
  });
}

export function calculateCustomMetricScores(
  entities: RankableEntity[],
  definitions: MetricDefinition[],
  formula: CustomMetricFormula,
): Map<string, number | null> {
  const definitionsByKey = new Map(definitions.map((definition) => [definition.key, definition]));
  const populations = new Map(formula.components.map((component) => [component.metricKey, metricPopulation(entities, component.metricKey)]));
  return new Map(entities.map((entity) => {
    let weightedScore = 0;
    let availableWeight = 0;
    for (const component of formula.components) {
      const definition = definitionsByKey.get(component.metricKey);
      const weight = Math.max(0, component.weight);
      if (!definition || weight === 0) continue;
      const score = metricDesirability(numericMetric(entity, component.metricKey), populations.get(component.metricKey) ?? [], definition.direction);
      if (score == null) continue;
      weightedScore += score * weight;
      availableWeight += weight;
    }
    return [entity.id, availableWeight ? (weightedScore / availableWeight) * 100 : null];
  }));
}

export function customMetricDefinition(metric: Pick<UserCustomMetric, "id" | "name" | "entityType">): MetricDefinition {
  return {
    key: `custom:${metric.id}`,
    label: metric.name,
    description: "Your weighted metric, calculated from the current dataset.",
    format: "decimal",
    direction: "desc",
    group: "Other",
    source: "My Metrics",
    tier: "core",
    entityType: metric.entityType,
    available: true,
    comparative: true,
  };
}
