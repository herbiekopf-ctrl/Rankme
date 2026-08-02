"use client";

import { useMemo, useState } from "react";
import { TeamMark } from "./TeamMark";
import { formatMetricValue, rankByMetric } from "@/lib/domain/metrics";
import type { DatasetEnvelope, RankableEntity } from "@/lib/domain/types";

export function ComparisonTool({
  dataset,
  selectedIds,
  onSelectedIdsChange,
  onClose,
}: {
  dataset: DatasetEnvelope;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  onClose: () => void;
}) {
  const metrics = useMemo(() => dataset.metricDefinitions ?? [], [dataset.metricDefinitions]);
  const [view, setView] = useState<"teams" | "leaders">("teams");
  const [metricKey, setMetricKey] = useState(metrics[0]?.key ?? "");
  const teamsById = useMemo(() => new Map(dataset.entities.map((entity) => [entity.id, entity])), [dataset.entities]);
  const selected = selectedIds.map((id) => teamsById.get(id)).filter((entity): entity is RankableEntity => Boolean(entity));
  const activeMetric = metrics.find((metric) => metric.key === metricKey) ?? metrics[0];
  const rankingsByMetric = useMemo(
    () => new Map(metrics.map((metric) => [metric.key, rankByMetric(dataset.entities, metric)])),
    [dataset.entities, metrics],
  );

  function addTeam(id: string) {
    if (!id || selectedIds.includes(id) || selectedIds.length >= 4) return;
    onSelectedIdsChange([...selectedIds, id]);
  }

  return (
    <section className="comparison-tool" aria-labelledby="comparison-title">
      <div className="comparison-topline">
        <div>
          <p className="kicker">DECISION DESK</p>
          <h2 id="comparison-title">Compare the case, then make the call.</h2>
        </div>
        <button className="comparison-close" onClick={onClose} aria-label="Close comparison tool">×</button>
      </div>

      <div className="comparison-tabs" role="tablist" aria-label="Comparison view">
        <button role="tab" aria-selected={view === "teams"} className={view === "teams" ? "active" : ""} onClick={() => setView("teams")}>Compare teams</button>
        <button role="tab" aria-selected={view === "leaders"} className={view === "leaders" ? "active" : ""} onClick={() => setView("leaders")}>Metric rankings</button>
      </div>

      {view === "teams" ? (
        <>
          <div className="comparison-picker">
            <label>
              <span>Add up to four teams</span>
              <select value="" onChange={(event) => addTeam(event.target.value)} disabled={selectedIds.length >= 4}>
                <option value="">Choose a team…</option>
                {dataset.entities.filter((entity) => !selectedIds.includes(entity.id)).map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
              </select>
            </label>
            <div className="comparison-chips">
              {selected.map((entity) => <button key={entity.id} onClick={() => onSelectedIdsChange(selectedIds.filter((id) => id !== entity.id))}>{entity.name} <span>×</span></button>)}
            </div>
          </div>
          {selected.length < 2 ? (
            <div className="comparison-empty"><strong>Select two teams.</strong><span>You can add teams here or use the compare button in the candidate pool.</span></div>
          ) : (
            <div className="metric-table-wrap">
              <table className="metric-table">
                <thead><tr><th>Metric</th>{selected.map((entity) => <th key={entity.id}><TeamMark entity={entity} /><span>{entity.name}</span></th>)}</tr></thead>
                <tbody>
                  <tr><th>Record</th>{selected.map((entity) => <td key={entity.id}><strong>{String(entity.attributes.record ?? "—")}</strong><small>{String(entity.attributes.conference ?? "")}</small></td>)}</tr>
                  {metrics.map((metric) => {
                    const ranks = rankingsByMetric.get(metric.key) ?? [];
                    const rankById = new Map(ranks.map((entry) => [entry.entity.id, entry]));
                    return <tr key={metric.key}><th><span>{metric.label}</span><small>{metric.description}</small></th>{selected.map((entity) => {
                      const entry = rankById.get(entity.id);
                      return <td key={entity.id}><strong>{formatMetricValue(entry?.value ?? null, metric)}</strong><small>{entry?.rank ? `#${entry.rank} of ${dataset.entities.length}` : "Season data pending"}</small></td>;
                    })}</tr>;
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : activeMetric ? (
        <div className="leader-view">
          <div className="leader-control">
            <label><span>Rank teams by</span><select value={activeMetric.key} onChange={(event) => setMetricKey(event.target.value)}>{metrics.map((metric) => <option key={metric.key} value={metric.key}>{metric.label}</option>)}</select></label>
            <p>{activeMetric.description}</p>
          </div>
          <ol className="leader-list">
            {(rankingsByMetric.get(activeMetric.key) ?? []).filter((entry) => entry.rank > 0).slice(0, 15).map((entry) => (
              <li key={entry.entity.id}><span className="leader-rank">{entry.rank}</span><TeamMark entity={entry.entity} /><strong>{entry.entity.name}</strong><span>{formatMetricValue(entry.value, activeMetric)}</span><button onClick={() => addTeam(entry.entity.id)} disabled={selectedIds.includes(entry.entity.id) || selectedIds.length >= 4}>Compare</button></li>
            ))}
          </ol>
          {!(rankingsByMetric.get(activeMetric.key) ?? []).some((entry) => entry.rank > 0) && <div className="comparison-empty"><strong>Metric data will populate when games begin.</strong><span>The saved CFBD snapshot is connected; this season does not have values for this metric yet.</span></div>}
        </div>
      ) : null}
    </section>
  );
}
