"use client";

import { useMemo, useState } from "react";
import { TeamMark } from "./TeamMark";
import { calculateCustomMetricScores, customMetricDefinition, formatMetricValue, metricDesirability, metricPopulation, numericMetric } from "@/lib/domain/metrics";
import type { DatasetEnvelope, MetricDefinition, RankableEntity, UserCustomMetric } from "@/lib/domain/types";

export function ComparisonTool({ dataset, selectedIds, rankedIds = [], customMetrics = [], onSelectedIdsChange, onOpenEntity = () => undefined, onAddEntity = () => undefined, onClose }: {
  dataset: DatasetEnvelope; selectedIds: string[]; rankedIds?: string[]; customMetrics?: UserCustomMetric[];
  onSelectedIdsChange: (ids: string[]) => void; onOpenEntity?: (id: string) => void; onAddEntity?: (id: string) => void; onClose: () => void;
}) {
  const baseMetrics = useMemo(() => dataset.metricDefinitions ?? [], [dataset.metricDefinitions]);
  const metrics = useMemo(() => [...baseMetrics, ...customMetrics.map(customMetricDefinition)], [baseMetrics, customMetrics]);
  const [metricQuery, setMetricQuery] = useState("");
  const [visibleKeys, setVisibleKeys] = useState(() => baseMetrics.filter((metric) => metric.tier === "core").slice(0, 5).map((metric) => metric.key));
  const entitiesById = useMemo(() => new Map(dataset.entities.map((entity) => [entity.id, entity])), [dataset.entities]);
  const selected = selectedIds.map((id) => entitiesById.get(id)).filter((entity): entity is RankableEntity => Boolean(entity));
  const rankedSet = new Set(rankedIds);
  const entityLabel = dataset.entities[0]?.entityType ?? "option";
  const customScores = useMemo(() => new Map(customMetrics.map((metric) => [metric.id, calculateCustomMetricScores(dataset.entities, baseMetrics, metric.formula)])), [baseMetrics, customMetrics, dataset.entities]);
  const populations = useMemo(() => new Map(baseMetrics.map((metric) => [metric.key, metricPopulation(dataset.entities, metric.key)])), [baseMetrics, dataset.entities]);
  const visibleMetrics = visibleKeys.flatMap((key) => { const metric = metrics.find((candidate) => candidate.key === key); return metric ? [metric] : []; });
  const matches = metrics.filter((metric) => `${metric.label} ${metric.group ?? ""}`.toLowerCase().includes(metricQuery.toLowerCase())).slice(0, 30);

  function valueFor(entity: RankableEntity, metric: MetricDefinition) { return metric.key.startsWith("custom:") ? customScores.get(metric.key.slice(7))?.get(entity.id) ?? null : numericMetric(entity, metric.key); }
  function heatFor(entity: RankableEntity, metric: MetricDefinition) { const value = valueFor(entity, metric); return metric.key.startsWith("custom:") ? value == null ? null : value / 100 : metricDesirability(value, populations.get(metric.key) ?? [], metric.direction); }
  function toggle(id: string) { onSelectedIdsChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]); }

  return <section className="comparison-tool" aria-labelledby="comparison-title">
    <div className="comparison-topline"><div><p className="kicker">INLINE COMPARISON</p><h2 id="comparison-title">Compare any {entityLabel}s in this ranking.</h2><p>Color shows relative strength across the full candidate pool.</p></div><button className="comparison-close" onClick={onClose} aria-label="Close comparison">×</button></div>
    <div className="comparison-selection-actions"><button onClick={() => onSelectedIdsChange(rankedIds)}>Select my whole ranking</button><button onClick={() => onSelectedIdsChange([])}>Clear</button><span>{selected.length} selected · no limit</span></div>
    <div className="comparison-entity-picker" role="group" aria-label="Choose entities to compare">{dataset.entities.map((entity) => <label key={entity.id} className={selectedIds.includes(entity.id) ? "is-selected" : ""}><input type="checkbox" checked={selectedIds.includes(entity.id)} onChange={() => toggle(entity.id)} /><TeamMark entity={entity} /><span>{entity.name}</span>{rankedSet.has(entity.id) && <small>#{rankedIds.indexOf(entity.id) + 1}</small>}</label>)}</div>
    <div className="comparison-metric-picker"><label><span>Add comparison columns</span><input value={metricQuery} onChange={(event) => setMetricQuery(event.target.value)} placeholder="Search metrics" /></label><div>{matches.map((metric) => <button key={metric.key} className={visibleKeys.includes(metric.key) ? "is-active" : ""} onClick={() => setVisibleKeys((current) => current.includes(metric.key) ? current.filter((key) => key !== metric.key) : [...current, metric.key])}>{metric.label}</button>)}</div></div>
    {selected.length ? <div className="metric-table-wrap"><table className="metric-table heatmap-table"><thead><tr><th>Team</th><th>Rank</th>{visibleMetrics.map((metric) => <th key={metric.key}><span>{metric.label}</span><small>{metric.direction === "asc" ? "Lower is better" : "Higher is better"}</small></th>)}</tr></thead><tbody>{selected.map((entity) => <tr key={entity.id}><th><button className="comparison-team-link" onClick={() => onOpenEntity(entity.id)}><TeamMark entity={entity} /><span>{entity.name}</span></button></th><td>{rankedSet.has(entity.id) ? `#${rankedIds.indexOf(entity.id) + 1}` : <button className="compact-rank-action" onClick={() => onAddEntity(entity.id)}>+ Rank</button>}</td>{visibleMetrics.map((metric) => { const value = valueFor(entity, metric); const heat = heatFor(entity, metric); return <td key={metric.key} className={heat == null ? "is-missing" : "heat-cell"} style={heat == null ? undefined : { "--heat": heat } as React.CSSProperties}><strong>{formatMetricValue(value, metric)}</strong></td>; })}</tr>)}</tbody></table></div> : <div className="comparison-empty"><strong>Select teams from your ranking or candidate pool.</strong><span>You can compare two, all 25, or anything in between.</span></div>}
  </section>;
}
