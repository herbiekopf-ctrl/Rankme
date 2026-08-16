"use client";

import { useMemo, type CSSProperties } from "react";
import { ComparisonTool } from "../ComparisonTool";
import { MetricInfo } from "../MetricInfo";
import { TeamMark } from "../TeamMark";
import type { RankingWorkspaceController } from "@/hooks/useRankingWorkspace";
import { calculateCustomMetricScores, formatMetricValue, metricDesirability, metricHeatPresentation, metricPopulation, rankByMetric } from "@/lib/domain/metrics";
import { formatAttribute } from "@/lib/utils";

export function AnalysisPane({ controller }: { controller: RankingWorkspaceController }) {
  const { analysisMode, candidates, compareIds, dataset, history, template } = controller;
  const hasMetrics = Boolean(dataset.metricDefinitions?.length);
  const activeMetric = dataset.metricDefinitions?.find((metric) => metric.key === controller.candidateSort);
  const activeCustomMetric = controller.candidateSort.startsWith("custom:")
    ? controller.customMetrics.metrics.find((metric) => metric.id === controller.candidateSort.slice(7))
    : undefined;
  const candidateSignals = useMemo(() => {
    if (activeMetric) {
      const population = metricPopulation(dataset.entities, activeMetric.key);
      return new Map(rankByMetric(dataset.entities, activeMetric).map((item) => {
        const heat = metricHeatPresentation(metricDesirability(item.value, population, activeMetric.direction));
        return [item.entity.id, { label: activeMetric.label, value: formatMetricValue(item.value, activeMetric), rank: item.rank, heat }];
      }));
    }
    if (activeCustomMetric) {
      const scores = calculateCustomMetricScores(dataset.entities, dataset.metricDefinitions ?? [], activeCustomMetric.formula);
      const sorted = [...dataset.entities].sort((left, right) => (scores.get(right.id) ?? -1) - (scores.get(left.id) ?? -1));
      return new Map(sorted.map((entity, index) => {
        const value = scores.get(entity.id) ?? null;
        const heat = metricHeatPresentation(value == null ? null : value / 100);
        return [entity.id, { label: activeCustomMetric.name, value: value == null ? "No data" : value.toFixed(1), rank: value == null ? 0 : index + 1, heat }];
      }));
    }
    return new Map();
  }, [activeCustomMetric, activeMetric, dataset.entities, dataset.metricDefinitions]);

  return (
    <section
      className={`rw-pane rw-analysis-pane${controller.mobileMode === "analyze" ? " is-mobile-active" : ""}`}
      aria-labelledby="analyze-heading"
      data-workspace-pane="analysis"
    >
      <div className="rw-pane-heading rw-analysis-heading">
        <div>
          <span>ANALYZE / COMPARE</span>
          <h2 id="analyze-heading">Pick, sort, compare</h2>
        </div>
        <div className="rw-analysis-tabs" role="tablist" aria-label="Analysis view">
          <button
            type="button"
            role="tab"
            aria-selected={analysisMode === "candidates"}
            className={analysisMode === "candidates" ? "is-active" : ""}
            onClick={() => controller.setAnalysisMode("candidates")}
          >Options</button>
          <button
            type="button"
            role="tab"
            aria-selected={analysisMode === "compare"}
            className={analysisMode === "compare" ? "is-active" : ""}
            disabled={!hasMetrics}
            onClick={() => controller.setAnalysisMode("compare")}
          >Compare{compareIds.length ? ` (${compareIds.length})` : ""}</button>
          <button type="button" role="tab" aria-selected={analysisMode === "metric-builder"} className={analysisMode === "metric-builder" ? "is-active" : ""} disabled={!hasMetrics} onClick={() => controller.setAnalysisMode("metric-builder")}>Live Model</button>
        </div>
      </div>

      <div className="rw-pane-body rw-analysis-body" data-scroll-region="analysis">
        {analysisMode === "compare" && hasMetrics ? (
          <ComparisonTool
            dataset={dataset}
            selectedIds={compareIds}
            rankedIds={history.present}
            customMetrics={controller.customMetrics.metrics}
            canRank={!controller.isPeriodLocked}
            onSelectedIdsChange={controller.setCompareIds}
            onOpenEntity={controller.setDetailId}
            onAddEntity={controller.addEntity}
            onFocusRankedEntity={controller.focusRankedEntity}
            onClose={() => controller.setAnalysisMode("candidates")}
          />
        ) : (
          <>
            <div className="rw-candidate-controls">
              <label className="search-box">
                <span aria-hidden="true">⌕</span>
                <input
                  value={controller.query}
                  onChange={(event) => controller.setQuery(event.target.value)}
                  placeholder={template.searchPlaceholder}
                />
                {controller.query && <button type="button" onClick={() => controller.setQuery("")} aria-label="Clear search">×</button>}
              </label>
              <div className="rw-filter-grid">
                {controller.hasConference && (
                  <label>
                    <span>Conference</span>
                    <select value={controller.conference} onChange={(event) => controller.setConference(event.target.value)} aria-label="Filter by conference">
                      <option>All</option>
                      {controller.conferences.map((value) => <option key={value}>{value}</option>)}
                    </select>
                  </label>
                )}
                {hasMetrics && (
                  <label>
                    <span>Sort candidates</span>
                    <select value={controller.candidateSort} onChange={(event) => controller.setCandidateSort(event.target.value)} aria-label="Sort candidates">
                      <option value="name">Name · A–Z</option>
                      {dataset.metricDefinitions?.map((metric) => (
                        <option key={metric.key} value={metric.key}>{metric.group ? `${metric.group} · ` : ""}{metric.label}</option>
                      ))}
                      {controller.customMetrics.metrics.map((metric) => <option key={metric.id} value={`custom:${metric.id}`}>My Metrics · {metric.name}</option>)}
                    </select>
                    {activeMetric && <MetricInfo metric={activeMetric} compact />}
                  </label>
                )}
                <span className="rw-candidate-count">{candidates.length} eligible</span>
              </div>
            </div>

            <div className="candidate-list rw-candidate-list">
              {candidates.map((entity) => {
                const signal = candidateSignals.get(entity.id);
                return <article className="candidate-card" key={entity.id}>
                  <TeamMark entity={entity} />
                  <div className="candidate-identity">
                    <strong>{entity.name}</strong>
                    {template.visibleAttributes.length > 0 && (
                      <span>{template.visibleAttributes.slice(0, 2).map((attribute) => formatAttribute(entity.attributes[attribute])).join(" · ")}</span>
                    )}
                    {entity.attributes.suggestion && <small>{formatAttribute(entity.attributes.suggestion)}</small>}
                  </div>
                  {signal && <div className={`candidate-metric-signal heat-${signal.heat.band}`} style={{ "--heat-bg": signal.heat.background, "--heat-border": signal.heat.border, "--heat-fg": signal.heat.foreground } as CSSProperties}><span>{signal.label}</span><strong>{signal.rank ? `#${signal.rank}` : "—"}</strong><small>{signal.value} · {signal.heat.label}</small></div>}
                  <div className="candidate-actions">
                    <button type="button" className="details" onClick={() => controller.setDetailId(entity.id)} aria-label={`Open ${entity.name} details`} title={`Open ${entity.name} details`}>Stats</button>
                    {hasMetrics && (
                      <button
                        type="button"
                        className={compareIds.includes(entity.id) ? "compare active" : "compare"}
                        onClick={() => controller.toggleCompare(entity.id)}
                        aria-label={`Compare ${entity.name}`}
                        title={`Compare ${entity.name}`}
                      >Compare</button>
                    )}
                    <button
                      type="button"
                      className="add-candidate"
                      disabled={controller.isPeriodLocked || history.present.length >= template.maxLength}
                      onClick={() => controller.addEntity(entity.id)}
                      aria-label={`Add ${entity.name}`}
                      title="Add to ranking"
                    >+ Rank</button>
                  </div>
                </article>;
              })}
              {!candidates.length && (
                <div className="no-results">
                  <strong>No eligible match.</strong>
                  <span>Try a nickname, abbreviation, or broader filter.</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
