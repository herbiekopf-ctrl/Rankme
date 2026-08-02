"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PlatformStatus } from "@/lib/domain/types";

const crossPolls = {
  coaches: [
    { name: "Dabo Swinney", average: 2.8, baseline: 6.9, people: 181 },
    { name: "Marcus Freeman", average: 5.2, baseline: 7.1, people: 126 },
    { name: "Dan Lanning", average: 4.7, baseline: 5.8, people: 154 },
  ],
  stadiums: [
    { name: "Memorial Stadium", average: 2.1, baseline: 7.4, people: 194 },
    { name: "Lane Stadium", average: 6.3, baseline: 9.0, people: 117 },
    { name: "Williams-Brice Stadium", average: 8.7, baseline: 10.2, people: 104 },
  ],
  conferences: [
    { name: "ACC", average: 2.2, baseline: 4.1, people: 203 },
    { name: "SEC", average: 2.9, baseline: 2.4, people: 211 },
    { name: "Big Ten", average: 3.8, baseline: 3.2, people: 198 },
  ],
} as const;

export function RelationalInsightsExplorer() {
  const [anchor, setAnchor] = useState("Clemson");
  const [maxPosition, setMaxPosition] = useState(5);
  const [crossPoll, setCrossPoll] = useState<keyof typeof crossPolls>("coaches");
  const [region, setRegion] = useState("All regions");
  const [age, setAge] = useState("All ages");
  const [experience, setExperience] = useState("All experience levels");
  const [status, setStatus] = useState<PlatformStatus | null>(null);

  useEffect(() => {
    fetch("/api/platform/status").then((response) => response.json() as Promise<PlatformStatus>).then(setStatus).catch(() => setStatus(null));
  }, []);

  const sample = useMemo(() => {
    let value = anchor === "Clemson" ? 318 : anchor === "Georgia" ? 441 : 387;
    if (region !== "All regions") value = Math.floor(value * (region === "New England" ? 0.21 : 0.48));
    if (age !== "All ages") value = Math.floor(value * 0.38);
    if (experience !== "All experience levels") value = Math.floor(value * 0.42);
    return value;
  }, [age, anchor, experience, region]);
  const suppressed = sample < 25;
  const filters = [region, age, experience].filter((value) => !value.startsWith("All"));
  const cohortDescription = [`ranked ${anchor} #${maxPosition} or higher`, ...filters].join(" · ");
  const demographicPatterns = [
    { label: region === "All regions" ? "South" : region, share: 64, baseline: 46 },
    { label: experience === "All experience levels" ? "Avid fan" : experience, share: 78, baseline: 61 },
    { label: age === "All ages" ? "Age 18-34" : age, share: 59, baseline: 48 },
  ];

  return (
    <div className="insights-page">
      <section className="insights-hero shell">
        <div><p className="kicker">RELATIONAL OPINION GRAPH</p><h1>See what rankings<br /><em>reveal about each other.</em></h1><p>Filter the crowd, define a ranking behavior, and discover what that same group tends to rank differently elsewhere.</p></div>
        <div className="insights-status"><span className={status?.schemaReady ? "data-badge is-live" : "data-badge"}>{status?.schemaReady ? "Supabase schema live" : "Database setup needed"}</span><strong>{status?.entityTypeCount ?? 14} connected entity types</strong><small>{status?.activeDatasetVersion ? `Dataset ${status.activeDatasetVersion}` : "Waiting for the first persisted CFBD refresh and real ballots"}</small></div>
      </section>

      <section className="insight-query-band">
        <div className="shell insight-query-grid">
          <label><span>People who ranked</span><select value={anchor} onChange={(event) => setAnchor(event.target.value)}><option>Clemson</option><option>Georgia</option><option>Ohio State</option></select></label>
          <label><span>At position</span><select value={maxPosition} onChange={(event) => setMaxPosition(Number(event.target.value))}><option value={1}>#1</option><option value={3}>Top 3</option><option value={5}>Top 5</option><option value={10}>Top 10</option></select></label>
          <label><span>Find patterns in</span><select value={crossPoll} onChange={(event) => setCrossPoll(event.target.value as keyof typeof crossPolls)}><option value="coaches">Coach rankings</option><option value="stadiums">Stadium rankings</option><option value="conferences">Conference rankings</option></select></label>
        </div>
      </section>

      <section className="shell insight-workspace">
        <aside className="cohort-filter-card">
          <p className="kicker">FILTER THE CROWD</p>
          <h2>Explicit AND filters</h2>
          <label><span>Region</span><select value={region} onChange={(event) => setRegion(event.target.value)}><option>All regions</option><option>South</option><option>New England</option><option>Midwest</option><option>West Coast</option></select></label>
          <label><span>Age band</span><select value={age} onChange={(event) => setAge(event.target.value)}><option>All ages</option><option>18-24</option><option>25-34</option><option>35-44</option></select></label>
          <label><span>Experience</span><select value={experience} onChange={(event) => setExperience(event.target.value)}><option>All experience levels</option><option>Avid fan</option><option>Casual fan</option><option>Analyst or creator</option></select></label>
          <div className="cohort-definition"><span>COHORT DEFINITION</span><strong>{cohortDescription}</strong><small>No individual user or demographic record is returned.</small></div>
        </aside>

        <div className="insight-results">
          {suppressed ? (
            <div className="suppressed-state"><span className="privacy-icon">◎</span><p className="kicker">PRIVACY GATE</p><h2>This combination is too narrow.</h2><p>Fewer than 25 eligible people match. Ranked returns no placements or traits until the crowd is large enough.</p><button className="button button-secondary" onClick={() => { setRegion("All regions"); setAge("All ages"); setExperience("All experience levels"); }}>Widen the cohort</button></div>
          ) : (
            <>
              <div className="result-receipt"><div><span>ANCHOR COHORT</span><strong>{sample.toLocaleString()} eligible rankers</strong></div><div><span>PRIVACY</span><strong>25-person minimum passed</strong></div><div><span>METHOD</span><strong>Affinity v1 · equal weight</strong></div></div>
              <section className="pattern-card"><div className="pattern-heading"><div><p className="kicker">CROSS-POLL SIMILARITIES</p><h2>They rank these higher too.</h2></div><span>vs matching baseline</span></div>{crossPolls[crossPoll].map((pattern, index) => { const lift = pattern.baseline - pattern.average; return <article className="pattern-row" key={pattern.name}><span className="pattern-rank">{index + 1}</span><div><strong>{pattern.name}</strong><small>{pattern.people} people ranked this option · subgroup minimum passed</small></div><div><strong>#{pattern.average.toFixed(1)}</strong><small>cohort average</small></div><span className={lift >= 0 ? "delta-up" : "delta-down"}>{lift >= 0 ? `↑ ${lift.toFixed(1)}` : `↓ ${Math.abs(lift).toFixed(1)}`}</span></article>; })}</section>
              <section className="pattern-card"><div className="pattern-heading"><div><p className="kicker">SHARED TRAITS</p><h2>What else is unusually common?</h2></div><span>aggregate only</span></div><div className="trait-grid">{demographicPatterns.map((pattern) => <article key={pattern.label}><strong>{pattern.label}</strong><span>{pattern.share}% of cohort</span><em>+{pattern.share - pattern.baseline} pts vs baseline</em></article>)}</div></section>
              <p className="insight-demo-note">Interface preview using synthetic aggregate counts. The live query is already installed in Supabase and begins returning real output only after eligible published ballots clear each privacy threshold.</p>
            </>
          )}
        </div>
      </section>
      <section className="shell insights-cta"><div><p className="kicker">BUILD THE GRAPH</p><h2>Every public ballot strengthens the connections.</h2></div><div className="insights-cta-actions"><Link className="button button-secondary" href="/profile">Add optional context</Link><Link className="button button-primary" href="/create">Create a poll →</Link></div></section>
    </div>
  );
}
