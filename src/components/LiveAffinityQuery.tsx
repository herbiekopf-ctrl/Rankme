"use client";

import { useEffect, useMemo, useState } from "react";

type CatalogTemplate = { templateId: string; templateVersionId: string; title: string; entities: Array<{ id: string; name: string }> };
type Catalog = { connected: boolean; message: string; templates: CatalogTemplate[] };
type AffinityResult = {
  suppressed: boolean;
  reason?: string;
  minimumCohort?: number;
  sampleSize?: number;
  rankingPatterns?: Array<{ entityId: string; name: string; people: number; averagePosition: number; baselineAveragePosition: number; positionLift: number }>;
  demographicPatterns?: Array<{ dimension: string; value: string; label: string; people: number; cohortShare: number; baselineShare: number; shareLift: number }>;
};

export function LiveAffinityQuery() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [anchorVersion, setAnchorVersion] = useState("");
  const [compareVersion, setCompareVersion] = useState("");
  const [anchorEntity, setAnchorEntity] = useState("");
  const [maxPosition, setMaxPosition] = useState(5);
  const [region, setRegion] = useState("");
  const [ageBand, setAgeBand] = useState("");
  const [experience, setExperience] = useState("");
  const [result, setResult] = useState<AffinityResult | null>(null);
  const [status, setStatus] = useState("Loading public polls…");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetch("/api/insights/catalog").then((response) => response.json() as Promise<Catalog>).then((next) => {
      setCatalog(next);
      setStatus(next.message);
      const first = next.templates[0];
      const second = next.templates[1] ?? first;
      setAnchorVersion(first?.templateVersionId ?? "");
      setCompareVersion(second?.templateVersionId ?? "");
      setAnchorEntity(first?.entities[0]?.id ?? "");
    }).catch(() => setStatus("Public polls are unavailable."));
  }, []);

  const anchorTemplate = useMemo(() => catalog?.templates.find((template) => template.templateVersionId === anchorVersion), [anchorVersion, catalog]);

  function chooseAnchorTemplate(versionId: string) {
    setAnchorVersion(versionId);
    const template = catalog?.templates.find((candidate) => candidate.templateVersionId === versionId);
    setAnchorEntity(template?.entities[0]?.id ?? "");
    setResult(null);
  }

  async function runQuery() {
    if (!anchorVersion || !compareVersion || !anchorEntity) return;
    setRunning(true);
    setStatus("Comparing privacy-safe voter groups…");
    try {
      const filters = Object.fromEntries(Object.entries({ geography: region, age_band: ageBand, experience }).filter(([, value]) => value));
      const response = await fetch("/api/insights/affinity", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ anchorTemplateVersionId: anchorVersion, anchorEntityId: anchorEntity, anchorMaxPosition: maxPosition, compareTemplateVersionId: compareVersion, filters }) });
      const body = await response.json() as AffinityResult & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "The live query failed.");
      setResult(body);
      setStatus(body.suppressed ? "This group is below the privacy floor." : "Community comparison ready.");
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : "The live query failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="live-affinity-card shell">
      <div className="live-affinity-heading"><div><p className="kicker">COMMUNITY VIEW</p><h2>Compare how groups rank.</h2><p>Only privacy-safe aggregate results are shown.</p></div><span className={catalog?.connected ? "data-badge is-live" : "data-badge"}>{catalog?.connected ? "Ready" : "Setup needed"}</span></div>
      {catalog?.templates.length ? <><div className="live-query-grid">
        <label><span>Anchor poll</span><select value={anchorVersion} onChange={(event) => chooseAnchorTemplate(event.target.value)}>{catalog.templates.map((template) => <option key={template.templateVersionId} value={template.templateVersionId}>{template.title}</option>)}</select></label>
        <label><span>People who ranked</span><select value={anchorEntity} onChange={(event) => setAnchorEntity(event.target.value)}>{anchorTemplate?.entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label>
        <label><span>At position</span><select value={maxPosition} onChange={(event) => setMaxPosition(Number(event.target.value))}><option value={1}>#1</option><option value={3}>Top 3</option><option value={5}>Top 5</option><option value={10}>Top 10</option></select></label>
        <label><span>Compare poll</span><select value={compareVersion} onChange={(event) => setCompareVersion(event.target.value)}>{catalog.templates.map((template) => <option key={template.templateVersionId} value={template.templateVersionId}>{template.title}</option>)}</select></label>
        <label><span>Region</span><select value={region} onChange={(event) => setRegion(event.target.value)}><option value="">All</option><option value="south">South</option><option value="midwest">Midwest</option><option value="west-coast">West Coast</option><option value="new-england">New England</option></select></label>
        <label><span>Age</span><select value={ageBand} onChange={(event) => setAgeBand(event.target.value)}><option value="">All</option><option value="18-24">18-24</option><option value="25-34">25-34</option><option value="35-44">35-44</option><option value="45-54">45-54</option><option value="55-plus">55+</option></select></label>
        <label><span>Experience</span><select value={experience} onChange={(event) => setExperience(event.target.value)}><option value="">All</option><option value="casual">Casual fan</option><option value="avid">Avid fan</option><option value="analyst">Analyst or creator</option></select></label>
        <button className="button button-primary" disabled={running} onClick={runQuery}>{running ? "Running…" : "Run private aggregate"}</button>
      </div>
      {result && <div className="live-query-results">{result.suppressed ? <div className="suppressed-inline"><strong>Result suppressed</strong><span>Fewer than {result.minimumCohort ?? 25} eligible people match. No sample count or placements were returned.</span></div> : <><div className="live-result-receipt"><strong>{result.sampleSize?.toLocaleString()} eligible rankers</strong><span>Privacy floor passed</span></div><div className="live-pattern-grid"><div><h3>Cross-poll lift</h3>{result.rankingPatterns?.slice(0, 8).map((pattern) => <p key={pattern.entityId}><strong>{pattern.name}</strong><span>#{pattern.averagePosition} · {pattern.positionLift > 0 ? "+" : ""}{pattern.positionLift} spots</span></p>)}</div><div><h3>Shared context</h3>{result.demographicPatterns?.slice(0, 8).map((pattern) => <p key={`${pattern.dimension}:${pattern.value}`}><strong>{pattern.label}</strong><span>{Math.round(pattern.cohortShare * 100)}% · +{Math.round(pattern.shareLift * 100)} pts</span></p>)}</div></div></>}</div>}
      </> : <div className="live-query-empty"><strong>No queryable poll graph yet.</strong><span>{status} Create at least two public polls and publish ballots from 25 or more eligible users.</span></div>}
      <p className="live-query-status">{status}</p>
    </section>
  );
}
