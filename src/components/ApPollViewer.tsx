"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { TeamMark } from "./TeamMark";
import type { ApPoll } from "@/lib/adapters/apPoll";
export function ApPollViewer() {
  const [poll, setPoll] = useState<ApPoll | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [voter, setVoter] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/ap-poll", { signal: abort.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(setPoll).catch(() => { if (!abort.signal.aborted) setError(true); });
    return () => abort.abort();
  }, [attempt]);
  if (error) return <section className="browse-empty" role="status"><h2>AP poll temporarily unavailable</h2><button onClick={() => { setError(false); setAttempt(a => a + 1); }}>Try again</button><p><a href="https://apnews.com/hub/ap-top-25-college-football-poll">View the AP poll at AP News →</a></p></section>;
  if (!poll) return <p role="status">Loading the AP poll and voter ballots…</p>;
  const ballot = poll.ballots.find(b => b.id === voter);
  const rows = ballot ? ballot.teamIds.map((id, i) => ({ ...poll.teams.find(t => t.id === id)!, rank: i + 1 })) : poll.teams.filter(t => t.rank <= 25);
  const release = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" }).format(new Date(poll.releasedAt));
  return <section className="top25-hero ap-poll" aria-labelledby="ap-heading">
    <header><div><p className="kicker">ASSOCIATED PRESS · {poll.season}</p><h1 id="ap-heading">{ballot ? ballot.name : "AP Top 25"}</h1><p>{poll.week.startsWith("Week") ? `After ${poll.week}` : poll.week} · Released {release}</p><small>This is the published AP poll, not your Ranked ballot.</small></div><Link className="ranking-entry-button" href="/rank/top-25">Make My Top 25 →</Link></header>
    <label className="ap-voter-select"><span>View the poll or an individual vote</span><select value={voter} onChange={e => setVoter(e.target.value)}><option value="">AP consensus{poll.ballots.length ? ` · ${poll.ballots.length} voters` : ""}</option>{poll.ballots.map(b => <option key={b.id} value={b.id}>{b.name} — {b.affiliation}</option>)}</select></label>
    {ballot ? <p className="ap-context">{ballot.affiliation} · Individual AP ballot</p> : <p className="ap-context">25 points for a #1 vote, down to 1 point for #25.</p>}
    {!poll.ballotsVerified ? <p role="status">Individual ballots are not yet verified for this release. The published AP totals are shown.</p> : null}
    <ol className="ap-ranking-list">{rows.map(team => <li key={team.id}><b>{team.rank}</b><TeamMark size="small" entity={{ id: team.id, name: team.name, entityType: "team", imageUrl: team.imageUrl, attributes: {} }} /><strong>{team.name}</strong>{!ballot ? <small>{team.points} pts</small> : null}</li>)}</ol>
    <footer className="ap-source"><a href={poll.sourceUrl}>AP poll and ballot data via College Poll Tracker ↗</a></footer>
  </section>;
}
