"use client";

import { useMemo, type CSSProperties } from "react";
import { MetricInfo } from "../MetricInfo";
import { RankingPositionControl } from "../RankingPositionControl";
import { TeamMark } from "../TeamMark";
import type { RankingWorkspaceController } from "@/hooks/useRankingWorkspace";
import { calculateCustomMetricScores, formatMetricValue, metricDesirability, metricHeatPresentation, metricPopulation, rankByMetric } from "@/lib/domain/metrics";
import { formatAttribute } from "@/lib/utils";

export function AnalysisPane({ controller }: { controller: RankingWorkspaceController }) {
  const { dataset, history, metricEntities, template } = controller;
  const hasMetrics = Boolean(dataset.metricDefinitions?.length);
  const activeMetric = dataset.metricDefinitions?.find((metric) => metric.key === controller.candidateSort);
  const activeCustomMetric = controller.candidateSort.startsWith("custom:")
    ? controller.customMetrics.metrics.find((metric) => metric.id === controller.candidateSort.slice(7))
    : undefined;
  const metricSignals = useMemo(() => {
    if (activeMetric) {
      const population = metricPopulation(dataset.entities, activeMetric.key);
      return new Map(rankByMetric(dataset.entities, activeMetric).map((item) => {
        const heat = metricHeatPresentation(metricDesirability(item.value, population, activeMetric.direction));
        return [item.entity.id, { value: formatMetricValue(item.value, activeMetric), rank: item.rank, heat }];
      }));
    }
    if (activeCustomMetric) {
      const scores = calculateCustomMetricScores(dataset.entities, dataset.metricDefinitions ?? [], activeCustomMetric.formula);
      const sorted = [...dataset.entities].sort((left, right) => (scores.get(right.id) ?? -1) - (scores.get(left.id) ?? -1));
      return new Map(sorted.map((entity, index) => {
        const value = scores.get(entity.id) ?? null;
        const heat = metricHeatPresentation(value == null ? null : value / 100);
        return [entity.id, { value: value == null ? "No data" : value.toFixed(1), rank: value == null ? 0 : index + 1, heat }];
      }));
    }
    return new Map();
  }, [activeCustomMetric, activeMetric, dataset.entities, dataset.metricDefinitions]);

  return (
    <section className={`rw-pane rw-analysis-pane${controller.mobileMode === "analyze" ? " is-mobile-active" : ""}`} aria-labelledby="rank-by-metric-heading" data-workspace-pane="analysis">
      <div className="rw-pane-heading rw-analysis-heading">
        <div><span>RANK BY METRIC</span><h2 id="rank-by-metric-heading">One stat. Every team.</h2></div>
        <button type="button" className="open-live-model" disabled={!hasMetrics} onClick={() => controller.setAnalysisMode("metric-builder")}>Live Model</button>
      </div>

      <div className="rw-pane-body rw-analysis-body" data-scroll-region="analysis">
        <div className="rw-candidate-controls">
          <label className="metric-rank-select">
            <span>Rank teams by</span>
            <select value={controller.candidateSort} onChange={(event) => controller.setCandidateSort(event.target.value)} aria-label="Rank teams by metric">
              {!hasMetrics ? <option value="name">Name · A–Z</option> : null}
              {dataset.metricDefinitions?.map((metric) => <option key={metric.key} value={metric.key}>{metric.group ? `${metric.group} · ` : ""}{metric.label}</option>)}
              {controller.customMetrics.metrics.map((metric) => <option key={metric.id} value={`custom:${metric.id}`}>My Metrics · {metric.name}</option>)}
            </select>
            {activeMetric ? <MetricInfo metric={activeMetric} compact /> : null}
          </label>
          <div className="rw-metric-secondary-controls">
            <label className="search-box">
              <span aria-hidden="true">⌕</span>
              <input value={controller.query} onChange={(event) => controller.setQuery(event.target.value)} placeholder={template.searchPlaceholder} />
              {controller.query ? <button type="button" onClick={() => controller.setQuery("")} aria-label="Clear search">×</button> : null}
            </label>
            {controller.hasConference ? <label className="metric-conference-filter"><span>Conference</span><select value={controller.conference} onChange={(event) => controller.setConference(event.target.value)} aria-label="Filter by conference"><option>All</option>{controller.conferences.map((value) => <option key={value}>{value}</option>)}</select></label> : null}
          </div>
          <p className="metric-tool-explainer">See the data order beside your ballot, then adjust your ranking here.</p>
        </div>

        <ol className="rank-by-metric-list">
          {metricEntities.map((entity, index) => {
            const signal = metricSignals.get(entity.id);
            const currentIndex = history.present.indexOf(entity.id);
            const currentRank = currentIndex >= 0 ? currentIndex + 1 : null;
            return <li key={entity.id}>
              <span className="metric-order">{signal?.rank ?? index + 1}</span>
              <TeamMark entity={entity} size="small" />
              <button type="button" className="metric-team-identity" onClick={() => controller.setDetailId(entity.id)}><strong>{entity.name}</strong><small>{template.visibleAttributes.slice(0, 2).map((attribute) => formatAttribute(entity.attributes[attribute])).filter(Boolean).join(" · ") || "Open team details"}</small></button>
              <div className={`metric-row-value heat-${signal?.heat.band ?? "missing"}`} style={signal ? { "--heat-bg": signal.heat.background, "--heat-border": signal.heat.border, "--heat-fg": signal.heat.foreground } as CSSProperties : undefined}><strong>{signal?.value ?? "No data"}</strong><small>{signal?.rank ? `Metric #${signal.rank}` : "Not ranked"}</small></div>
              <RankingPositionControl entityName={entity.name} currentRank={currentRank} rankingLength={history.present.length} maxLength={template.maxLength} disabled={controller.isPeriodLocked} onAdd={(position) => controller.addEntity(entity.id, position)} onMove={(position) => controller.moveRankedEntity(entity.id, position)} />
            </li>;
          })}
        </ol>
        {!metricEntities.length ? <div className="no-results"><strong>No eligible match.</strong><span>Try a nickname, abbreviation, or broader filter.</span></div> : null}
      </div>
    </section>
  );
}
