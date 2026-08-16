"use client";

import { useMemo, useState } from "react";
import { calculateCustomMetricScores } from "@/lib/domain/metrics";
import type { RankingWorkspaceController } from "@/hooks/useRankingWorkspace";

export function CustomMetricBuilder({ controller }: { controller: RankingWorkspaceController }) {
  const definitions = useMemo(() => (controller.dataset.metricDefinitions ?? []).filter((metric) => metric.comparative !== false), [controller.dataset.metricDefinitions]);
  const [name, setName] = useState("");
  const [weights, setWeights] = useState<Record<string, number>>(() => Object.fromEntries(definitions.slice(0, 3).map((metric) => [metric.key, 1])));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("All");
  const components = Object.entries(weights).filter(([, weight]) => weight > 0).map(([metricKey, weight]) => ({ metricKey, weight }));
  const scores = useMemo(
    () => calculateCustomMetricScores(controller.dataset.entities, definitions, { version: 1, normalization: "percentile", components: Object.entries(weights).filter(([, weight]) => weight > 0).map(([metricKey, weight]) => ({ metricKey, weight })) }),
    [controller.dataset.entities, definitions, weights],
  );
  const formula = { version: 1 as const, normalization: "percentile" as const, components };
  const preview = [...controller.dataset.entities].sort((a, b) => (scores.get(b.id) ?? -1) - (scores.get(a.id) ?? -1)).slice(0, 12);
  const groups = ["All", ...new Set(definitions.map((metric) => metric.group ?? "Other"))];
  const visibleDefinitions = definitions.filter((metric) => (group === "All" || (metric.group ?? "Other") === group) && `${metric.label} ${metric.description}`.toLowerCase().includes(query.toLowerCase()));

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

  return <section className="custom-metric-builder" aria-labelledby="custom-metric-title">
    <div className="custom-metric-heading"><div><p className="kicker">BUILD YOUR MODEL</p><h3 id="custom-metric-title">Create a named metric</h3><p>Mix any of {definitions.length} useful stats. The preview reacts immediately; your ranking never changes unless you choose to change it.</p></div></div>
    <label className="custom-metric-name"><span>Metric name</span><input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="My Resume Score" /></label>
    <div className="custom-metric-discovery"><label><span>Find a metric · {components.length}/12 selected</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search schedule, offense, defense, talent…" /></label><div>{groups.map((value) => <button key={value} className={group === value ? "is-active" : ""} onClick={() => setGroup(value)}>{value}</button>)}</div></div>
    <div className="custom-metric-layout">
      <div className="custom-metric-inputs">
        {visibleDefinitions.map((metric) => {
          const weight = weights[metric.key] ?? 0;
          return <label key={metric.key} className={weight ? "is-weighted" : ""}><span><strong>{metric.label}</strong><small>{metric.group ?? "Other"}</small></span><input type="range" min="0" max="5" step="0.25" value={weight} onChange={(event) => updateWeight(metric.key, Number(event.target.value))} aria-label={`${metric.label} weight`} /><output>{weight.toFixed(2)}×</output></label>;
        })}{visibleDefinitions.length === 0 && <p className="metric-result-note">No metrics match that search.</p>}
      </div>
      <div className="custom-metric-preview"><h4>Live model order</h4><ol>{preview.map((entity, index) => <li key={entity.id}><span>{index + 1}</span><strong>{entity.name}</strong><output>{scores.get(entity.id)?.toFixed(1) ?? "—"}</output></li>)}</ol></div>
    </div>
    {message && <p className="form-error" role="alert">{message}</p>}
    <div className="custom-metric-actions"><button className="button button-secondary" onClick={() => controller.setAnalysisMode("candidates")}>Cancel</button><button className="button button-primary" disabled={!controller.canPublishRelational || saving || !name.trim() || !components.length} onClick={() => void save()}>{saving ? "Saving…" : "Save metric"}</button></div>
    {!controller.canPublishRelational && <p className="metric-result-note">Sign in with a permanent account to save and reuse personal metrics.</p>}
  </section>;
}
