"use client";

import { useDeferredValue, useMemo, useState, type CSSProperties } from "react";
import { MetricInfo } from "./MetricInfo";
import { TeamMark } from "./TeamMark";
import {
  calculateCustomMetricScores,
  customMetricDefinition,
  formatMetricValue,
  metricDesirability,
  metricHeatPresentation,
  metricPopulation,
  metricRanksByEntity,
  numericMetric,
  rankDifference,
} from "@/lib/domain/metrics";
import type { DatasetEnvelope, MetricDefinition, RankableEntity, UserCustomMetric } from "@/lib/domain/types";

function ordinalRanks(values: Array<{ id: string; value: number | null }>): Map<string, number> {
  const sorted = [...values].sort((left, right) => {
    if (left.value == null) return 1;
    if (right.value == null) return -1;
    return right.value - left.value;
  });
  let lastValue: number | null | undefined;
  let rank = 0;
  return new Map(sorted.flatMap((item, index) => {
    if (item.value == null) return [];
    if (item.value !== lastValue) rank = index + 1;
    lastValue = item.value;
    return [[item.id, rank] as const];
  }));
}

export function ComparisonTool({ dataset, selectedIds, rankedIds = [], customMetrics = [], canRank = true, onSelectedIdsChange, onOpenEntity = () => undefined, onAddEntity = () => undefined, onFocusRankedEntity = () => undefined, onClose }: {
  dataset: DatasetEnvelope;
  selectedIds: string[];
  rankedIds?: string[];
  customMetrics?: UserCustomMetric[];
  canRank?: boolean;
  onSelectedIdsChange: (ids: string[]) => void;
  onOpenEntity?: (id: string) => void;
  onAddEntity?: (id: string) => void;
  onFocusRankedEntity?: (id: string) => void;
  onClose: () => void;
}) {
  const baseMetrics = useMemo(() => dataset.metricDefinitions ?? [], [dataset.metricDefinitions]);
  const metrics = useMemo(() => [...baseMetrics, ...customMetrics.map(customMetricDefinition)], [baseMetrics, customMetrics]);
  const [metricQuery, setMetricQuery] = useState("");
  const [entityQuery, setEntityQuery] = useState("");
  const deferredEntityQuery = useDeferredValue(entityQuery.trim().toLowerCase());
  const [visibleKeys, setVisibleKeys] = useState(() => baseMetrics.filter((metric) => metric.tier === "core").slice(0, 5).map((metric) => metric.key));
  const entitiesById = useMemo(() => new Map(dataset.entities.map((entity) => [entity.id, entity])), [dataset.entities]);
  const selected = selectedIds.map((id) => entitiesById.get(id)).filter((entity): entity is RankableEntity => Boolean(entity));
  const rankedSet = useMemo(() => new Set(rankedIds), [rankedIds]);
  const entityLabel = dataset.entities[0]?.entityType ?? "option";
  const customScores = useMemo(() => new Map(customMetrics.map((metric) => [metric.id, calculateCustomMetricScores(dataset.entities, baseMetrics, metric.formula)])), [baseMetrics, customMetrics, dataset.entities]);
  const populations = useMemo(() => new Map(baseMetrics.map((metric) => [metric.key, metricPopulation(dataset.entities, metric.key)])), [baseMetrics, dataset.entities]);
  const visibleMetrics = visibleKeys.flatMap((key) => { const metric = metrics.find((candidate) => candidate.key === key); return metric ? [metric] : []; });
  const matches = metrics.filter((metric) => `${metric.label} ${metric.group ?? ""}`.toLowerCase().includes(metricQuery.toLowerCase())).slice(0, 30);
  const entityMatches = useMemo(() => dataset.entities.filter((entity) => !deferredEntityQuery || `${entity.name} ${entity.shortName ?? ""} ${(entity.aliases ?? []).join(" ")}`.toLowerCase().includes(deferredEntityQuery)), [dataset.entities, deferredEntityQuery]);
  const ranksByMetric = useMemo(() => new Map(visibleMetrics.map((metric) => {
    if (metric.key.startsWith("custom:")) {
      const scores = customScores.get(metric.key.slice(7));
      return [metric.key, ordinalRanks(dataset.entities.map((entity) => ({ id: entity.id, value: scores?.get(entity.id) ?? null })))] as const;
    }
    return [metric.key, new Map([...metricRanksByEntity(dataset.entities, metric)].map(([id, item]) => [id, item.rank]))] as const;
  })), [customScores, dataset.entities, visibleMetrics]);

  function valueFor(entity: RankableEntity, metric: MetricDefinition) {
    return metric.key.startsWith("custom:") ? customScores.get(metric.key.slice(7))?.get(entity.id) ?? null : numericMetric(entity, metric.key);
  }
  function heatFor(entity: RankableEntity, metric: MetricDefinition) {
    const value = valueFor(entity, metric);
    return metric.key.startsWith("custom:") ? value == null ? null : value / 100 : metricDesirability(value, populations.get(metric.key) ?? [], metric.direction);
  }
  function toggle(id: string) { onSelectedIdsChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]); }
  function rankAction(entity: RankableEntity) {
    const userRank = rankedIds.indexOf(entity.id) + 1;
    return userRank > 0
      ? <button className="compact-rank-action is-ranked" onClick={() => onFocusRankedEntity(entity.id)}>#{userRank}</button>
      : <button className="compact-rank-action" disabled={!canRank} onClick={() => onAddEntity(entity.id)}>{canRank ? "+ Rank" : "Closed"}</button>;
  }

  return <section className="comparison-tool" aria-labelledby="comparison-title">
    <div className="comparison-topline"><div><p className="kicker">COMPARE</p><h2 id="comparison-title">Compare any {entityLabel}s.</h2><p>Green is stronger. Red is weaker. Rank and labels keep every signal accessible.</p></div><button className="comparison-close" onClick={onClose} aria-label="Close comparison">×</button></div>
    <div className="comparison-selection-actions"><button onClick={() => onSelectedIdsChange(rankedIds)}>My whole ranking</button><button onClick={() => onSelectedIdsChange([])}>Clear</button><span>{selected.length} selected · no limit</span></div>
    <label className="comparison-entity-search"><span aria-hidden="true">⌕</span><input value={entityQuery} onChange={(event) => setEntityQuery(event.target.value)} placeholder={`Find ${entityLabel}s`} /></label>
    <div className="comparison-entity-picker" role="group" aria-label="Choose entities to compare">{entityMatches.map((entity) => <label key={entity.id} className={selectedIds.includes(entity.id) ? "is-selected" : ""}><input type="checkbox" checked={selectedIds.includes(entity.id)} onChange={() => toggle(entity.id)} /><TeamMark entity={entity} size="small" /><span>{entity.name}</span>{rankedSet.has(entity.id) && <small>#{rankedIds.indexOf(entity.id) + 1}</small>}</label>)}</div>
    <div className="comparison-metric-picker"><label><span>Metrics</span><input value={metricQuery} onChange={(event) => setMetricQuery(event.target.value)} placeholder="Search metrics" /></label><div>{matches.map((metric) => <button key={metric.key} className={visibleKeys.includes(metric.key) ? "is-active" : ""} onClick={() => setVisibleKeys((current) => current.includes(metric.key) ? current.filter((key) => key !== metric.key) : [...current, metric.key])}>{metric.label}</button>)}</div></div>
    {selected.length ? <>
      <div className="metric-table-wrap comparison-desktop-table"><table className="metric-table heatmap-table"><thead><tr><th>Team</th><th>My rank</th>{visibleMetrics.map((metric) => <th key={metric.key}><span>{metric.label}<MetricInfo metric={metric} compact /></span><small>{metric.direction === "asc" ? "Lower is better" : "Higher is better"}</small></th>)}</tr></thead><tbody>{selected.map((entity) => <tr key={entity.id}><th><button className="comparison-team-link" onClick={() => onOpenEntity(entity.id)}><TeamMark entity={entity} size="small" /><span>{entity.name}</span></button></th><td>{rankAction(entity)}</td>{visibleMetrics.map((metric) => {
        const value = valueFor(entity, metric);
        const rank = ranksByMetric.get(metric.key)?.get(entity.id) ?? 0;
        const heat = metricHeatPresentation(heatFor(entity, metric));
        return <td key={metric.key} className={`heat-cell heat-${heat.band}`} style={{ "--heat-bg": heat.background, "--heat-border": heat.border, "--heat-fg": heat.foreground } as CSSProperties}><strong>{formatMetricValue(value, metric)}</strong><small>{rank ? `#${rank} · ${heat.label}` : heat.label}</small></td>;
      })}</tr>)}</tbody></table></div>
      <div className="comparison-mobile-stack">{selected.map((entity) => {
        const myRank = rankedIds.indexOf(entity.id) + 1 || null;
        return <article key={entity.id} className="comparison-mobile-card">
          <header><button onClick={() => onOpenEntity(entity.id)}><TeamMark entity={entity} size="small" /><span><strong>{entity.name}</strong><small>{myRank ? `Your rank #${myRank}` : "Not ranked"}</small></span></button>{rankAction(entity)}</header>
          <div>{visibleMetrics.map((metric) => {
            const value = valueFor(entity, metric);
            const metricRank = ranksByMetric.get(metric.key)?.get(entity.id) ?? 0;
            const heat = metricHeatPresentation(heatFor(entity, metric));
            const difference = metricRank ? rankDifference(myRank, metricRank) : null;
            return <section key={metric.key} className={`comparison-mobile-metric heat-${heat.band}`} style={{ "--heat-bg": heat.background, "--heat-border": heat.border, "--heat-fg": heat.foreground } as CSSProperties}>
              <span>{metric.label}<MetricInfo metric={metric} compact /></span>
              <strong>{metricRank ? `#${metricRank}` : "—"}</strong>
              <small>{formatMetricValue(value, metric)} · {heat.label}</small>
              {difference?.amount != null && <b className={`movement-${difference.tone}`}>{difference.label} vs you</b>}
            </section>;
          })}</div>
        </article>;
      })}</div>
    </> : <div className="comparison-empty"><strong>Select options to compare.</strong><span>Choose two, your whole ranking, or anything in between.</span></div>}
  </section>;
}
