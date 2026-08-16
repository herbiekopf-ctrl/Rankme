"use client";

import type { MetricDefinition } from "@/lib/domain/types";

export function MetricInfo({ metric, compact = false }: { metric: MetricDefinition; compact?: boolean }) {
  const direction = metric.direction === "asc" ? "Lower is better" : "Higher is better";
  const context = metric.context === "prior-season" && metric.season
    ? `${metric.season} · prior-season context`
    : metric.season
      ? `${metric.season} data`
      : null;

  return <details className={`metric-info${compact ? " is-compact" : ""}`}>
    <summary aria-label={`About ${metric.label}`} title={`About ${metric.label}`}>i</summary>
    <div className="metric-info-popover">
      <strong>{metric.label}</strong>
      <p>{metric.description}</p>
      <span>{direction}{metric.unitLabel ? ` · ${metric.unitLabel}` : ""}</span>
      {context && <span>{context}</span>}
      {metric.source && <small>{metric.source}</small>}
    </div>
  </details>;
}
