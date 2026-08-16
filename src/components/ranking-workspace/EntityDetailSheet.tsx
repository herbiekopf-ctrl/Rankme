"use client";

import { useEffect, useState } from "react";
import { TeamMark } from "../TeamMark";
import type { RankingWorkspaceController } from "@/hooks/useRankingWorkspace";
import type { EntityAnalyticsSnapshot } from "@/lib/domain/types";
import { formatAttribute } from "@/lib/utils";
import { formatMetricValue, numericMetric } from "@/lib/domain/metrics";

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
  const entityAnalytics = analytics?.entityId === entity.relationalId ? analytics : null;
  const completedGames = entityAnalytics?.games.filter((game) => game.completed) ?? [];

  return <div className="rw-sheet-backdrop" role="presentation" onMouseDown={() => setDetailId(null)}><aside className="rw-detail-sheet analytics-card-sheet" role="dialog" aria-modal="true" aria-labelledby="entity-detail-title" onMouseDown={(event) => event.stopPropagation()}>
    <button type="button" className="modal-close" onClick={() => setDetailId(null)} aria-label="Close details">×</button>
    <div className="analytics-card-hero"><TeamMark entity={entity} size="large" /><div><p className="kicker">TEAM SNAPSHOT</p><h2 id="entity-detail-title">{entity.name}</h2><span>{String(entity.attributes.conference ?? entity.entityType)}{isRanked ? ` · your #${rankIndex + 1}` : " · eligible"}</span></div><strong className="analytics-card-record">{String(entity.attributes.record ?? "Preseason")}</strong></div>
    <div className="analytics-card-metrics">{metrics.slice(0, 6).map((metric) => <div key={metric.key}><span>{metric.label}</span><strong>{formatMetricValue(numericMetric(entity, metric.key), metric)}</strong></div>)}{!metrics.length && <p>Season analytics will fill in as data becomes available.</p>}</div>
    {entity.entityType === "team" && <section className="analytics-schedule"><div><h3>Schedule & scores</h3><span>{completedGames.length ? `${completedGames.filter((game) => game.result === "W").length} wins in completed games` : "No completed results yet"}</span></div>{entityAnalytics ? entityAnalytics.games.length ? <ol>{entityAnalytics.games.map((game) => <li key={game.id}><span>Wk {game.week ?? "—"}</span><strong>{game.location === "away" ? "at " : "vs "}{game.opponent}</strong><time>{game.date ? new Date(game.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "TBD"}</time><output className={game.result ? `result-${game.result.toLowerCase()}` : ""}>{game.result ? `${game.result} ${game.scoreLabel}` : game.scoreLabel}</output></li>)}</ol> : <p>No schedule has been published for this season.</p> : <p>Loading schedule…</p>}</section>}
    <button className="analytics-more-toggle" onClick={() => setShowMore((value) => !value)}>{showMore ? "Hide additional stats" : "More stats"}</button>
    {showMore && <div className="entity-detail-grid rw-detail-grid">{Object.entries(entity.attributes).filter(([, value]) => value !== null && value !== "").map(([key, value]) => <div key={key}><span>{key.replace(/([a-z])([A-Z])/g, "$1 $2")}</span><strong>{formatAttribute(value)}</strong></div>)}</div>}
    <div className="entity-detail-actions rw-detail-actions"><button type="button" className="button button-secondary" onClick={() => { if (!controller.compareIds.includes(entity.id)) controller.toggleCompare(entity.id); else { controller.setAnalysisMode("compare"); controller.setMobileMode("analyze"); } setDetailId(null); }}>{controller.compareIds.includes(entity.id) ? "Open comparison" : "Compare"}</button><button type="button" className="button button-primary" disabled={isRanked || controller.history.present.length >= controller.template.maxLength} onClick={() => { controller.addEntity(entity.id); setDetailId(null); }}>{isRanked ? `Ranked #${rankIndex + 1}` : "+ Rank"}</button></div>
  </aside></div>;
}
