"use client";

import { Fragment, useEffect, useState, type CSSProperties } from "react";
import { MetricInfo } from "../MetricInfo";
import { RankingPositionControl } from "../RankingPositionControl";
import { TeamMark } from "../TeamMark";
import type { RankingWorkspaceController } from "@/hooks/useRankingWorkspace";
import type { EntityAnalyticsSnapshot, EntityGameSnapshot, RankableEntity } from "@/lib/domain/types";
import { formatAttribute } from "@/lib/utils";
import { formatMetricValue, metricDesirability, metricHeatPresentation, metricPopulation, metricRanksByEntity, numericMetric, rankDifference } from "@/lib/domain/metrics";

function opponentEntity(game: EntityGameSnapshot): RankableEntity {
  return { id: game.opponentEntityId ?? game.id, entityType: "team", name: game.opponent, imageUrl: game.opponentImageUrl ?? undefined, color: game.opponentColor ?? undefined, attributes: {} };
}

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
  const nextGameIndex = entityAnalytics?.games.findIndex((game) => !game.completed) ?? -1;
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
    {entity.entityType === "team" && entityAnalytics ? <section className="signature-results" aria-label="Best win and worst loss">
      {([{"label":"Best win","empty":"No wins yet","game":entityAnalytics.bestWin},{"label":"Worst loss","empty":"No losses yet","game":entityAnalytics.worstLoss}] as const).map(({ label, empty, game }) => game ? <div key={label}><span>{label}</span><TeamMark entity={opponentEntity(game)} size="small" /><strong>{game.opponent}</strong><small>{game.result} {game.scoreLabel}{game.difficultyRank ? ` · opponent #${game.difficultyRank}` : ""}</small></div> : <div className="is-empty" key={label}><span>{label}</span><strong>{empty}</strong><small>Updates after completed games.</small></div>)}
    </section> : null}
    {entity.entityType === "team" && <section className="analytics-schedule">
      <div><div><h3>Schedule & scores</h3><span>{completedGames.length ? `${completedGames.filter((game) => game.result === "W").length} wins in completed games` : "No completed results yet"}</span></div><small className="difficulty-legend">Favorable <i /> Tough</small></div>
      {entityAnalytics ? entityAnalytics.games.length ? <ol>{entityAnalytics.games.map((game, index) => <Fragment key={game.id}>
        {index === nextGameIndex ? <li className="schedule-next-divider"><span>Next game</span></li> : null}
        <li className={game.completed ? "is-completed" : "is-upcoming"}>
          <span className="schedule-week">Wk {game.week ?? "—"}</span>
          <TeamMark entity={opponentEntity(game)} size="small" />
          <strong><small>{game.location === "away" ? "AT" : game.location === "neutral" ? "NEUTRAL" : "VS"}</small>{game.opponent}</strong>
          <time>{game.date ? new Date(game.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "TBD"}</time>
          <div className="game-difficulty" style={{ "--difficulty": game.difficultyScore ?? .5 } as CSSProperties}><i /><span>{game.difficultyLabel ?? "No rating"}{game.difficultyRank ? ` · #${game.difficultyRank}` : ""}</span></div>
          <output className={game.result ? `result-${game.result.toLowerCase()}` : ""}>{game.result ? `${game.result} ${game.scoreLabel}` : game.scoreLabel}</output>
        </li>
      </Fragment>)}</ol> : <p>No schedule has been published for this season.</p> : <p>Loading schedule…</p>}
    </section>}
    <button className="analytics-more-toggle" onClick={() => setShowMore((value) => !value)}>{showMore ? "Hide additional stats" : "More stats"}</button>
    {showMore && <div className="entity-detail-grid rw-detail-grid">{detailRows.map(({ key, label, formatted, metric }) => <div key={key}><span>{label}{metric && <MetricInfo metric={metric} compact />}</span><strong>{formatted}</strong></div>)}</div>}
    <div className="entity-detail-actions rw-detail-actions"><RankingPositionControl entityName={entity.name} currentRank={isRanked ? rankIndex + 1 : null} rankingLength={controller.history.present.length} maxLength={controller.template.maxLength} disabled={controller.isPeriodLocked} onAdd={(position) => controller.addEntity(entity.id, position)} onMove={(position) => controller.moveRankedEntity(entity.id, position)} /><button type="button" className="button button-secondary" onClick={() => setDetailId(null)}>Done</button></div>
  </aside></div>;
}
