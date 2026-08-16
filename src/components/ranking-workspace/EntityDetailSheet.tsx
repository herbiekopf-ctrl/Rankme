"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { MetricInfo } from "../MetricInfo";
import { TeamMark } from "../TeamMark";
import type { RankingWorkspaceController } from "@/hooks/useRankingWorkspace";
import type { EntityAnalyticsSnapshot } from "@/lib/domain/types";
import { formatAttribute } from "@/lib/utils";
import { formatMetricValue, metricDesirability, metricHeatPresentation, metricPopulation, metricRanksByEntity, numericMetric, rankDifference } from "@/lib/domain/metrics";

export function EntityDetailSheet({ controller }: { controller: RankingWorkspaceController }) {
  const entity = controller.detailEntity;
  const setDetailId = controller.setDetailId;
  const [analytics, setAnalytics] = useState<EntityAnalyticsSnapshot | null>(null);
  const [showMore, setShowMore] = useState(false);
  useEffect(() => {
    if (!entity) return;
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") setDetailId(null); }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [entity, setDetailId]);
  useEffect(() => {
    if (!entity?.relationalId || entity.entityType !== "team") return;
    const controller = new AbortController();
    fetch(`/api/college-football/entity-analytics?entityId=${encodeURIComponent(entity.relationalId)}&season=2026`, { signal: controller.signal }).then((response) => response.ok ? response.json() : null).then((data) => setAnalytics(data)).catch(() => undefined);
    return () => controller.abort();
  }, [entity]);
  if (!entity) return null;
  const rankIndex = controller.history.present.indexOf(entity.id); const isRanked = rankIndex >= 0;
  const metrics = (controller.dataset.metricDefinitions ?? []).filter((metric) => numericMetric(entity, metric.key) != null);
  const metricSignals = metrics.slice(0, 6).map((metric) => {
    const value = numericMetric(entity, metric.key);
    const metricRank = metricRanksByEntity(controller.dataset.entities, metric).get(entity.id)?.rank ?? 0;
    const heat = metricHeatPresentation(metricDesirability(value, metricPopulation(controller.dataset.entities, metric.key), metric.direction));
    return { metric, value, metricRank, heat, difference: metricRank ? rankDifference(isRanked ? rankIndex + 1 : null, metricRank) : null };
  });
  const metricsByKey = new Map(metrics.map((metric) => [metric.key, metric]));
  const detailRows = Object.entries(entity.attributes).flatMap(([key, value]) => {
    if (value === null || value === "") return [];
    const metric = metricsByKey.get(key);
    const label = metric?.label ?? key
      .replace(/^prior:\d{4}:/, "Last season · ")
      .replaceAll(":", " · ")
      .replace(/([a-z])([A-Z])/g, "$1 $2");
    const formatted = metric && typeof value === "number" ? formatMetricValue(value, metric) : formatAttribute(value);
    return [{ key, label, formatted, metric }];
  });
  const entityAnalytics = analytics?.entityId === entity.relationalId ? analytics : null;
  const completedGames = entityAnalytics?.games.filter((game) => game.completed) ?? [];
  const entityLabel = entity.entityType.replaceAll("-", " ");
  const headlineKey = entity.entityType === "team"
    ? "record"
    : controller.template.visibleAttributes.find((key) => entity.attributes[key] !== null && entity.attributes[key] !== "");
  const headlineValue = headlineKey ? entity.attributes[headlineKey] : null;
  const headline = headlineValue === null || headlineValue === undefined || headlineValue === "" ? null : formatAttribute(headlineValue);
  const affiliation = entity.attributes.conference ?? entity.attributes.team ?? entity.attributes.city ?? entityLabel;

  return <div className="rw-sheet-backdrop" role="presentation" onMouseDown={() => setDetailId(null)}><aside className="rw-detail-sheet analytics-card-sheet" role="dialog" aria-modal="true" aria-labelledby="entity-detail-title" onMouseDown={(event) => event.stopPropagation()}>
    <button type="button" className="modal-close" onClick={() => setDetailId(null)} aria-label="Close details">×</button>
    <div className="analytics-card-hero"><TeamMark entity={entity} size="large" /><div><p className="kicker">{entityLabel.toLocaleUpperCase()} SNAPSHOT</p><h2 id="entity-detail-title">{entity.name}</h2><span>{String(affiliation)}{isRanked ? ` · your #${rankIndex + 1}` : " · eligible"}</span></div>{(headline || entity.entityType === "team") && <strong className="analytics-card-record">{headline ?? "Preseason"}</strong>}</div>
    <div className="analytics-card-metrics">{metricSignals.map(({ metric, value, metricRank, heat, difference }) => <div key={metric.key} className={`heat-${heat.band}`} style={{ "--heat-bg": heat.background, "--heat-border": heat.border, "--heat-fg": heat.foreground } as CSSProperties}><span>{metric.label}<MetricInfo metric={metric} compact /></span><strong>{metricRank ? `#${metricRank}` : "—"}</strong><small>{formatMetricValue(value, metric)} · {heat.label}</small>{difference?.amount != null && <b className={`movement-${difference.tone}`}>{difference.label} vs you</b>}</div>)}{!metrics.length && <p>Season analytics will fill in as data becomes available.</p>}</div>
    {entity.entityType === "team" && <section className="analytics-schedule"><div><h3>Schedule & scores</h3><span>{completedGames.length ? `${completedGames.filter((game) => game.result === "W").length} wins in completed games` : "No completed results yet"}</span></div>{entityAnalytics ? entityAnalytics.games.length ? <ol>{entityAnalytics.games.map((game) => <li key={game.id}><span>Wk {game.week ?? "—"}</span><strong>{game.location === "away" ? "at " : "vs "}{game.opponent}</strong><time>{game.date ? new Date(game.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "TBD"}</time><output className={game.result ? `result-${game.result.toLowerCase()}` : ""}>{game.result ? `${game.result} ${game.scoreLabel}` : game.scoreLabel}</output></li>)}</ol> : <p>No schedule has been published for this season.</p> : <p>Loading schedule…</p>}</section>}
    <button className="analytics-more-toggle" onClick={() => setShowMore((value) => !value)}>{showMore ? "Hide additional stats" : "More stats"}</button>
    {showMore && <div className="entity-detail-grid rw-detail-grid">{detailRows.map(({ key, label, formatted, metric }) => <div key={key}><span>{label}{metric && <MetricInfo metric={metric} compact />}</span><strong>{formatted}</strong></div>)}</div>}
    <div className="entity-detail-actions rw-detail-actions"><button type="button" className="button button-secondary" onClick={() => { if (!controller.compareIds.includes(entity.id)) controller.toggleCompare(entity.id); else { controller.setAnalysisMode("compare"); controller.setMobileMode("analyze"); } setDetailId(null); }}>{controller.compareIds.includes(entity.id) ? "Open comparison" : "Compare"}</button><button type="button" className="button button-primary" disabled={!isRanked && (controller.isPeriodLocked || controller.history.present.length >= controller.template.maxLength)} onClick={() => { if (isRanked) controller.focusRankedEntity(entity.id); else controller.addEntity(entity.id); setDetailId(null); }}>{isRanked ? `Go to #${rankIndex + 1}` : "+ Rank"}</button></div>
  </aside></div>;
}
