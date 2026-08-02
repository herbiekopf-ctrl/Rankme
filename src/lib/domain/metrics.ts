import type { MetricDefinition, RankableEntity } from "./types";

export type MetricRank = { entity: RankableEntity; rank: number; value: number | null };

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

export function formatMetricValue(value: number | null, metric: MetricDefinition): string {
  if (value == null) return "Not yet available";
  if (metric.format === "percentage") return `${(value * 100).toFixed(1)}%`;
  if (metric.format === "signed") return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
  if (metric.format === "decimal") return value.toFixed(1);
  return Math.round(value).toLocaleString("en-US");
}
