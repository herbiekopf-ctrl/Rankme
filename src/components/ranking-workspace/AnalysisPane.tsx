"use client";

import { ComparisonTool } from "../ComparisonTool";
import { TeamMark } from "../TeamMark";
import type { RankingWorkspaceController } from "@/hooks/useRankingWorkspace";
import { formatAttribute } from "@/lib/utils";
import { CustomMetricBuilder } from "./CustomMetricBuilder";

export function AnalysisPane({ controller }: { controller: RankingWorkspaceController }) {
  const { analysisMode, candidates, compareIds, dataset, history, template } = controller;
  const hasMetrics = Boolean(dataset.metricDefinitions?.length);

  return (
    <section
      className={`rw-pane rw-analysis-pane${controller.mobileMode === "analyze" ? " is-mobile-active" : ""}`}
      aria-labelledby="analyze-heading"
      data-workspace-pane="analysis"
    >
      <div className="rw-pane-heading rw-analysis-heading">
        <div>
          <span>ANALYZE / COMPARE</span>
          <h2 id="analyze-heading">Use data without leaving your ranking</h2>
        </div>
        <div className="rw-analysis-tabs" role="tablist" aria-label="Analysis view">
          <button
            type="button"
            role="tab"
            aria-selected={analysisMode === "candidates"}
            className={analysisMode === "candidates" ? "is-active" : ""}
            onClick={() => controller.setAnalysisMode("candidates")}
          >Candidates</button>
          <button
            type="button"
            role="tab"
            aria-selected={analysisMode === "compare"}
            className={analysisMode === "compare" ? "is-active" : ""}
            disabled={!hasMetrics}
            onClick={() => controller.setAnalysisMode("compare")}
          >Compare{compareIds.length ? ` (${compareIds.length})` : ""}</button>
          <button type="button" role="tab" aria-selected={analysisMode === "metric-builder"} className={analysisMode === "metric-builder" ? "is-active" : ""} disabled={!hasMetrics} onClick={() => controller.setAnalysisMode("metric-builder")}>Create metric</button>
        </div>
      </div>

      <div className="rw-pane-body rw-analysis-body" data-scroll-region="analysis">
        {analysisMode === "compare" && hasMetrics ? (
          <ComparisonTool
            dataset={dataset}
            selectedIds={compareIds}
            rankedIds={history.present}
            customMetrics={controller.customMetrics.metrics}
            onSelectedIdsChange={controller.setCompareIds}
            onOpenEntity={controller.setDetailId}
            onAddEntity={controller.addEntity}
            onClose={() => controller.setAnalysisMode("candidates")}
          />
        ) : analysisMode === "metric-builder" && hasMetrics ? (
          <CustomMetricBuilder controller={controller} />
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
                  </label>
                )}
                <span className="rw-candidate-count">{candidates.length} eligible</span>
              </div>
            </div>

            <div className="candidate-list rw-candidate-list">
              {candidates.map((entity) => (
                <article className="candidate-card" key={entity.id}>
                  <TeamMark entity={entity} />
                  <div className="candidate-identity">
                    <strong>{entity.name}</strong>
                    {template.visibleAttributes.length > 0 && (
                      <span>{template.visibleAttributes.slice(0, 2).map((attribute) => formatAttribute(entity.attributes[attribute])).join(" · ")}</span>
                    )}
                    {entity.attributes.suggestion && <small>{formatAttribute(entity.attributes.suggestion)}</small>}
                  </div>
                  <div className="candidate-actions">
                    <button type="button" className="details" onClick={() => controller.setDetailId(entity.id)} aria-label={`Open ${entity.name} details`} title={`Open ${entity.name} details`}>i</button>
                    {hasMetrics && (
                      <button
                        type="button"
                        className={compareIds.includes(entity.id) ? "compare active" : "compare"}
                        onClick={() => controller.toggleCompare(entity.id)}
                        aria-label={`Compare ${entity.name}`}
                        title={`Compare ${entity.name}`}
                      >⇄</button>
                    )}
                    <button
                      type="button"
                      className="add-candidate"
                      disabled={history.present.length >= template.maxLength}
                      onClick={() => controller.addEntity(entity.id)}
                      aria-label={`Add ${entity.name}`}
                      title="Add to ranking"
                    >+</button>
                  </div>
                </article>
              ))}
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
