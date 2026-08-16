"use client";

import { useEffect, useState } from "react";
import type { UserCustomMetric } from "@/lib/domain/types";
import { deleteMyCustomMetric, loadMyCustomMetrics, saveMyCustomMetric } from "@/lib/supabase/customMetrics";

export function MyMetrics() {
  const [metrics, setMetrics] = useState<UserCustomMetric[]>([]); const [message, setMessage] = useState("Loading…");
  useEffect(() => { loadMyCustomMetrics().then((items) => { setMetrics(items); setMessage(items.length ? "" : "You have not saved a custom metric yet."); }).catch(() => setMessage("Sign in to view and manage your saved metrics.")); }, []);
  async function remove(metric: UserCustomMetric) { if (!window.confirm(`Delete “${metric.name}”?`)) return; await deleteMyCustomMetric(metric.id); setMetrics((current) => current.filter((item) => item.id !== metric.id)); }
  async function duplicate(metric: UserCustomMetric) { const copy = await saveMyCustomMetric({ name: `${metric.name} copy`, entityType: metric.entityType, formula: metric.formula }); setMetrics((current) => [copy, ...current]); }
  return <section className="my-metrics-panel" aria-labelledby="my-metrics-title"><div><p className="kicker">MY METRICS</p><h2 id="my-metrics-title">Your saved models</h2><p>Personal formulas are stored with their creator and calculated from the current compatible dataset.</p></div>{message && <p>{message}</p>}{metrics.length > 0 && <div className="my-metrics-table-wrap"><table><thead><tr><th>Name</th><th>Applies to</th><th>Formula</th><th>Creator</th><th>Actions</th></tr></thead><tbody>{metrics.map((metric) => <tr key={metric.id}><th>{metric.name}</th><td>{metric.entityType}</td><td>{metric.formula.components.map((component) => `${component.metricKey} × ${component.weight}`).join(" + ")}</td><td>You</td><td><button onClick={() => void duplicate(metric)}>Duplicate</button><button className="danger-link" onClick={() => void remove(metric)}>Delete</button></td></tr>)}</tbody></table></div>}</section>;
}
