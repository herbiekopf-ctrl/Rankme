"use client";

import { useEffect, useMemo, useState } from "react";
import { TeamMark } from "../TeamMark";
import { calculateCustomMetricScores } from "@/lib/domain/metrics";
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const components = Object.entries(weights).filter(([, weight]) => weight > 0).map(([metricKey, weight]) => ({ metricKey, weight }));
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
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedInModelOrder = modelOrder.filter((entity) => selectedSet.has(entity.id));
  const selectedUnranked = selectedInModelOrder.filter((entity) => !controller.rankedSet.has(entity.id));
  const availableSpots = Math.max(0, controller.template.maxLength - controller.history.present.length);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setAnalysisMode("candidates");
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
      controller.setAnalysisMode("candidates");
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

  function toggleSelected(entityId: string) {
    setSelectedIds((current) => current.includes(entityId)
      ? current.filter((id) => id !== entityId)
      : [...current, entityId]);
  }

  function addSelected() {
    if (!selectedUnranked.length || !availableSpots) return;
    controller.commit([
      ...controller.history.present,
      ...selectedUnranked.slice(0, availableSpots).map((entity) => entity.id),
    ]);
  }

  function compareSelected() {
    if (!selectedIds.length) return;
    controller.setCompareIds(selectedInModelOrder.map((entity) => entity.id));
    controller.setAnalysisMode("compare");
    controller.setMobileMode("analyze");
  }

  return <div className="metric-overlay" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) controller.setAnalysisMode("candidates");
  }}>
    <section className="custom-metric-builder metric-overlay-card" role="dialog" aria-modal="true" aria-labelledby="custom-metric-title">
      <header className="custom-metric-heading">
        <div><p className="kicker">CREATE METRIC</p><h3 id="custom-metric-title">Build a live model</h3><p>Weight stats. Pick options. Keep your ranking in view.</p></div>
        <button type="button" className="metric-overlay-close" onClick={() => controller.setAnalysisMode("candidates")} aria-label="Close metric builder">×</button>
      </header>

      <div className="metric-overlay-layout">
        <div className="metric-builder-controls">
          <label className="custom-metric-name"><span>Name</span><input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="My Resume Score" autoFocus /></label>
          <div className="custom-metric-discovery"><label><span>Metrics · {components.length}/12</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search metrics" /></label><div>{groups.map((value) => <button type="button" key={value} className={group === value ? "is-active" : ""} onClick={() => setGroup(value)}>{value}</button>)}</div></div>
          <div className="custom-metric-inputs">
            {visibleDefinitions.map((metric) => {
              const weight = weights[metric.key] ?? 0;
              return <label key={metric.key} className={weight ? "is-weighted" : ""}><span><strong>{metric.label}</strong><small>{metric.group ?? "Other"}</small></span><input type="range" min="0" max="5" step="0.25" value={weight} onChange={(event) => updateWeight(metric.key, Number(event.target.value))} aria-label={`${metric.label} weight`} /><output>{weight.toFixed(2)}×</output></label>;
            })}{visibleDefinitions.length === 0 && <p className="metric-result-note">No match.</p>}
          </div>
        </div>

        <aside className="metric-current-ranking" aria-labelledby="metric-current-ranking-title">
          <div><p className="kicker">YOUR RANKING</p><h4 id="metric-current-ranking-title">{controller.history.present.length}/{controller.template.defaultLength}</h4></div>
          {controller.rankedEntities.length ? <ol>{controller.rankedEntities.map((entity, index) => <li key={entity.id}><span>{index + 1}</span><TeamMark entity={entity} size="small" /><strong>{entity.name}</strong></li>)}</ol> : <p className="metric-result-note">Add teams from the model.</p>}
        </aside>

        <div className="custom-metric-preview">
          <div className="metric-preview-heading"><div><p className="kicker">MODEL ORDER</p><h4>Live ranking</h4></div><span>{selectedIds.length} selected</span></div>
          <div className="metric-preview-actions">
            <button type="button" disabled={!selectedIds.length} onClick={compareSelected}>Compare</button>
            <button type="button" disabled={!selectedUnranked.length || !availableSpots} onClick={addSelected}>+ Rank selected</button>
            <button type="button" disabled={!selectedIds.length} onClick={() => setSelectedIds([])}>Clear</button>
          </div>
          <ol>{modelOrder.map((entity, index) => {
            const currentRank = controller.history.present.indexOf(entity.id) + 1;
            const selected = selectedSet.has(entity.id);
            return <li key={entity.id} className={selected ? "is-selected" : ""}>
              <button type="button" className="metric-select-team" aria-pressed={selected} onClick={() => toggleSelected(entity.id)} aria-label={`${selected ? "Deselect" : "Select"} ${entity.name}`}><span aria-hidden="true">{selected ? "✓" : ""}</span></button>
              <span className="metric-model-rank">{index + 1}</span>
              <TeamMark entity={entity} size="small" />
              <button type="button" className="metric-model-team" onClick={() => controller.setDetailId(entity.id)}><strong>{entity.name}</strong><small>{currentRank ? `Your #${currentRank}` : "Not ranked"}</small></button>
              <output>{scores.get(entity.id)?.toFixed(1) ?? "—"}</output>
              {currentRank ? <button type="button" className="metric-ranked-position" onClick={() => { controller.setAnalysisMode("candidates"); controller.setMobileMode("ranking"); }}>#{currentRank}</button> : <button type="button" className="metric-rank-team" disabled={!availableSpots} onClick={() => controller.addEntity(entity.id)}>+ Rank</button>}
            </li>;
          })}</ol>
        </div>
      </div>
      {message && <p className="form-error metric-overlay-message" role="alert">{message}</p>}
      <footer className="custom-metric-actions"><span>{!controller.canPublishRelational ? "Sign in to save this metric." : "Saving never changes your ranking."}</span><button className="button button-secondary" onClick={() => controller.setAnalysisMode("candidates")}>Close</button><button className="button button-primary" disabled={!controller.canPublishRelational || saving || !name.trim() || !components.length} onClick={() => void save()}>{saving ? "Saving…" : "Save metric"}</button></footer>
    </section>
  </div>;
}
