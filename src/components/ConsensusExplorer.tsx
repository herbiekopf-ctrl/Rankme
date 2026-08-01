"use client";

import { useState } from "react";
import Link from "next/link";
import { TeamMark } from "./TeamMark";
import { seedTeams } from "@/lib/domain/seed";
import { isCohortSuppressed } from "@/lib/domain/consensus";

const cohorts = {
  national: { label: "All fans", description: "United States · all eligible fans", sample: 2482, shift: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  south: { label: "The South", description: "Southern states · all allegiances", sample: 686, shift: [1, 1, 0, 2, -2, 0, 2, -1, 1, 0] },
  northeast: { label: "New England", description: "New England · all allegiances", sample: 94, shift: [0, -1, 2, 0, 1, -1, 0, 2, -2, 0] },
  clemson: { label: "Clemson fans", description: "Self-selected Clemson allegiance", sample: 18, shift: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
} as const;

type CohortKey = keyof typeof cohorts;

export function ConsensusExplorer() {
  const [selected, setSelected] = useState<CohortKey>("national");
  const cohort = cohorts[selected];
  const suppressed = isCohortSuppressed(cohort.sample);

  return (
    <div className="consensus-page">
      <section className="consensus-hero shell">
        <div><p className="kicker">THE PEOPLE&apos;S POLL</p><h1>College football,<br /><em>according to us.</em></h1><p>Every eligible ballot counts equally. Change the crowd to see where opinions split—without exposing anyone inside it.</p></div>
        <Link href="/rank/top-25" className="button button-primary">Add your ballot →</Link>
      </section>
      <section className="cohort-bar">
        <div className="shell cohort-controls">
          <div><span>SHOW CONSENSUS FOR</span><strong>{cohort.description}</strong></div>
          <div className="cohort-buttons">
            {(Object.entries(cohorts) as [CohortKey, (typeof cohorts)[CohortKey]][]).map(([key, value]) => (
              <button key={key} className={selected === key ? "active" : ""} onClick={() => setSelected(key)}>{value.label}</button>
            ))}
          </div>
          <div className="sample-size"><strong>{cohort.sample.toLocaleString()}</strong><span>eligible ballots</span></div>
        </div>
      </section>

      <section className="shell consensus-content">
        {suppressed ? (
          <div className="suppressed-state">
            <span className="privacy-icon">◎</span>
            <p className="kicker">PRIVACY GATE</p>
            <h2>This crowd is too small to show.</h2>
            <p>Ranked suppresses cohorts below 25 eligible people. Widen the segment to protect individual fans from being inferred.</p>
            <button className="button button-secondary" onClick={() => setSelected("south")}>Use The South instead</button>
          </div>
        ) : (
          <>
            <div className="consensus-title"><div><p className="kicker">PRESEASON · 2026</p><h2>{cohort.label} Top 10</h2></div><div><span>Method</span><strong>Equal-weight AP points</strong><small>25 points for #1 · method v1</small></div></div>
            <div className="consensus-table">
              <div className="consensus-head"><span>Rank</span><span>Team</span><span>Avg. rank</span><span>1st place</span><span>vs national</span></div>
              {seedTeams.slice(0, 10).map((team, index) => {
                const shift = cohort.shift[index];
                return (
                  <article className="consensus-row" key={team.id}>
                    <span className="consensus-rank">{index + 1}</span>
                    <div className="consensus-team"><TeamMark entity={team} /><span><strong>{team.name}</strong><small>{team.attributes.conference}</small></span></div>
                    <span>{(index + 1 + (index % 3) * 0.2).toFixed(1)}</span>
                    <span>{Math.max(1, 594 - index * 57).toLocaleString()}</span>
                    <span className={shift > 0 ? "delta-up" : shift < 0 ? "delta-down" : "delta-flat"}>{shift > 0 ? `↑ ${shift}` : shift < 0 ? `↓ ${Math.abs(shift)}` : "—"}</span>
                  </article>
                );
              })}
            </div>
            <p className="consensus-note">Demo aggregate · Sample size and cohort definition always travel with the result. Filters use explicit AND logic.</p>
          </>
        )}
      </section>
    </div>
  );
}
