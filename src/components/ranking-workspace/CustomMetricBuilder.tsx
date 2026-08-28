"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { MetricInfo } from "../MetricInfo";
import { RankingPositionControl } from "../RankingPositionControl";
import { TeamMark } from "../TeamMark";
import { calculateCustomMetricScores, formatMetricValue, metricDesirability, metricHeatPresentation, metricPopulation, metricRanksByEntity, numericMetric, rankDifference } from "@/lib/domain/metrics";
import type { RankingWorkspaceController } from "@/hooks/useRankingWorkspace";

export function CustomMetricBuilder({ controller }: { controller: RankingWorkspaceController }) {
  const setAnalysisMode = controller.setAnalysisMode;
  const definitions = useMemo(() => (controller.dataset.metricDefinitions ?? []).filter((metric) => metric.comparative !== false), [controller.dataset.metricDefinitions]);
  const [name, setName] = useState("");
  const [weights, setWeights] = useState<Record<string, number>>(() => Object.fromEntries(definitions.slice(0, 3).map((metric) => [metric.key, 1])));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("All");
  const [mobileSection, setMobileSection] = useState<"inputs" | "results">("results");
  const components = useMemo(
    () => Object.entries(weights).filter(([, weight]) => weight > 0).map(([metricKey, weight]) => ({ metricKey, weight })),
    [weights],
  );
  const scores = useMemo(
    () => calculateCustomMetricScores(controller.dataset.entities, definitions, { version: 1, normalization: "percentile", components: Object.entries(weights).filter(([, weight]) => weight > 0).map(([metricKey, weight]) => ({ metricKey, weight })) }),
    [controller.dataset.entities, definitions, weights],
  );
  const formula = { version: 1 as const, normalization: "percentile" as const, components };
  const modelOrder = useMemo(
    () => [...controller.dataset.entities].sort((a, b) => (scores.get(b.id) ?? -1) - (scores.get(a.id) ?? -1)),
    [controller.dataset.entities, scores],
  );
  const groups = ["All", ...new Set(definitions.map((metric) => metric.group ?? "Other"))];
  const visibleDefinitions = definitions.filter((metric) => (group === "All" || (metric.group ?? "Other") === group) && `${metric.label} ${metric.description}`.toLowerCase().includes(query.toLowerCase()));
  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
  const signalMetrics = useMemo(() => [...components]
      .sort((left, right) => right.weight - left.weight)
      .slice(0, 3)
      .flatMap((component) => {
        const definition = definitions.find((metric) => metric.key === component.metricKey);
        if (!definition) return [];
        return [{
          definition,
          population: metricPopulation(controller.dataset.entities, definition.key),
          ranks: metricRanksByEntity(controller.dataset.entities, definition),
        }];
      }), [components, controller.dataset.entities, definitions]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setAnalysisMode("metric");
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [setAnalysisMode]);

  async function save() {
    if (!name.trim() || !components.length) return;
    setSaving(true); setMessage("");
    try {
      const saved = await controller.customMetrics.save(name, formula);
      controller.setCandidateSort(`custom:${saved.id}`);
      controller.setAnalysisMode("metric");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not save this metric.");
    } finally { setSaving(false); }
  }
  function updateWeight(metricKey: string, weight: number) {
    if (weight > 0 && !weights[metricKey] && components.length >= 12) {
      setMessage("Use up to 12 inputs in one custom metric.");
      return;
    }
    setMessage("");
    setWeights((current) => ({ ...current, [metricKey]: weight }));
  }

  return <div className="metric-overlay" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) controller.setAnalysisMode("metric");
  }}>
    <section className="custom-metric-builder metric-overlay-card" role="dialog" aria-modal="true" aria-labelledby="custom-metric-title">
      <header className="custom-metric-heading">
        <div><p className="kicker">LIVE MODEL</p><h3 id="custom-metric-title">Build your live model</h3><p>Move the sliders. See how the teams rank based on what you care about.</p></div>
        <button type="button" className="metric-overlay-close" onClick={() => controller.setAnalysisMode("metric")} aria-label="Close live model">×</button>
      </header>

      <div className="metric-mobile-sections" role="tablist" aria-label="Live model section">
        <button type="button" role="tab" aria-selected={mobileSection === "inputs"} className={mobileSection === "inputs" ? "is-active" : ""} onClick={() => setMobileSection("inputs")}>Model inputs <span>{components.length}</span></button>
        <button type="button" role="tab" aria-selected={mobileSection === "results"} className={mobileSection === "results" ? "is-active" : ""} onClick={() => setMobileSection("results")}>Results <span>{modelOrder.length}</span></button>
      </div>

      <div className="metric-overlay-layout">
        <div className={`metric-builder-controls${mobileSection === "inputs" ? " is-mobile-active" : ""}`}>
          <label className="custom-metric-name"><span>Name to save (optional)</span><input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="My Resume Score" /></label>
          <div className="custom-metric-discovery"><label><span>Metrics · {components.length}/12</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search metrics" /></label><div>{groups.map((value) => <button type="button" key={value} className={group === value ? "is-active" : ""} onClick={() => setGroup(value)}>{value}</button>)}</div></div>
          <div className="custom-metric-inputs">
            {visibleDefinitions.map((metric) => {
              const weight = weights[metric.key] ?? 0;
              const percentage = totalWeight && weight ? Math.round((weight / totalWeight) * 100) : 0;
              return <label key={metric.key} className={weight ? "is-weighted" : ""}><span><span className="metric-input-title"><strong>{metric.label}</strong><MetricInfo metric={metric} compact /></span><small>{metric.group ?? "Other"}</small></span><input type="range" min="0" max="5" step="0.25" value={weight} onChange={(event) => updateWeight(metric.key, Number(event.target.value))} aria-label={`${metric.label} weight`} /><output>{percentage}%</output></label>;
            })}{visibleDefinitions.length === 0 && <p className="metric-result-note">No match.</p>}
          </div>
        </div>

        <div className={`custom-metric-preview${mobileSection === "results" ? " is-mobile-active" : ""}`}>
          <div className="metric-preview-heading"><div><p className="kicker">MODEL ORDER</p><h4>Live ranking</h4></div><span>{modelOrder.length} teams</span></div>
          <ol>{modelOrder.map((entity, index) => {
            const currentRank = controller.history.present.indexOf(entity.id) + 1;
            const difference = rankDifference(currentRank || null, index + 1);
            const modelScore = scores.get(entity.id) ?? null;
            const modelHeat = metricHeatPresentation(modelScore == null ? null : modelScore / 100);
            return <li key={entity.id} className={`model-${difference.tone}`}>
              <span className="metric-model-rank">{index + 1}</span>
              <TeamMark entity={entity} size="small" />
              <button type="button" className="metric-model-team" onClick={() => controller.setDetailId(entity.id)}><strong>{entity.name}</strong><small>{currentRank ? `My #${currentRank} → Model #${index + 1}` : `Model #${index + 1} · not on your ballot`}</small><b className={`movement-${difference.tone}`}>{difference.amount == null ? "Not ranked by you" : `${difference.label} vs you`}</b></button>
              <output className={`heat-${modelHeat.band}`} style={{ "--heat-bg": modelHeat.background, "--heat-border": modelHeat.border, "--heat-fg": modelHeat.foreground } as CSSProperties}>{modelScore?.toFixed(1) ?? "—"}<small>{modelHeat.label}</small></output>
              <RankingPositionControl entityName={entity.name} currentRank={currentRank || null} rankingLength={controller.history.present.length} maxLength={controller.template.maxLength} disabled={controller.isPeriodLocked} onAdd={(position) => controller.addEntity(entity.id, position)} onMove={(position) => controller.moveRankedEntity(entity.id, position)} />
              <div className="metric-model-signals">{signalMetrics.map(({ definition, population, ranks }) => {
                const value = numericMetric(entity, definition.key);
                const metricRank = ranks.get(entity.id)?.rank ?? 0;
                const heat = metricHeatPresentation(metricDesirability(value, population, definition.direction));
                const metricDifference = metricRank ? rankDifference(currentRank || null, metricRank) : null;
                return <span key={definition.key} className={`heat-${heat.band}`} style={{ "--heat-bg": heat.background, "--heat-border": heat.border, "--heat-fg": heat.foreground } as CSSProperties}><small>{definition.label}</small><strong>{metricRank ? `#${metricRank}` : "—"}</strong><em>{formatMetricValue(value, definition)}</em>{metricDifference?.amount != null && <b className={`movement-${metricDifference.tone}`}>{metricDifference.label}</b>}</span>;
              })}</div>
            </li>;
          })}</ol>
        </div>
      </div>
      {message && <p className="form-error metric-overlay-message" role="alert">{message}</p>}
      <footer className="custom-metric-actions"><span>{!controller.canPublishRelational ? "Sign in to save this model." : "Name it only if you want to reuse it."}</span><button className="button button-secondary" onClick={() => controller.setAnalysisMode("metric")}>Close</button><button className="button button-primary" disabled={!controller.canPublishRelational || saving || !name.trim() || !components.length} onClick={() => void save()}>{saving ? "Saving…" : "Save model"}</button></footer>
    </section>
  </div>;
}
