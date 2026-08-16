"use client";

import { useEffect, useState } from "react";
import { loadMyRankingHistory, type SavedRankingHistory } from "@/lib/supabase/rankingHistory";

function stamp(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function MyRankings() {
  const [rankings, setRankings] = useState<SavedRankingHistory[]>([]);
  const [message, setMessage] = useState("Loading your ranking history…");
  useEffect(() => { void loadMyRankingHistory().then((items) => { setRankings(items); setMessage(items.length ? "" : "Your saved rankings will appear here."); }).catch(() => setMessage("Sign in to see saved drafts and published rankings.")); }, []);
  return <section className="my-rankings-panel" aria-labelledby="my-rankings-title"><div className="my-rankings-heading"><div><p className="kicker">RANKING HISTORY</p><h2 id="my-rankings-title">Your opinions over time</h2><p>Every cloud draft and published ballot is dated. Published ballots stay as historical snapshots when you create the next one.</p></div><span>{rankings.length} saved</span></div>{message && <p>{message}</p>}<div className="ranking-history-list">{rankings.map((ranking) => <details key={ranking.id}><summary><div><strong>{ranking.title}</strong><span className={`history-status ${ranking.status}`}>{ranking.status}</span></div><time>{ranking.status === "published" && ranking.publishedAt ? `Published ${stamp(ranking.publishedAt)}` : `Updated ${stamp(ranking.updatedAt)}`}</time><small>{ranking.placements.length} ranked · revision {ranking.revision}</small></summary><ol>{ranking.placements.map((placement) => <li key={placement.position}><span>{placement.position}</span><i style={{ background: placement.color ?? "#6e7a72" }}>{placement.name.slice(0, 2).toUpperCase()}</i><strong>{placement.name}</strong></li>)}</ol><footer>Created {stamp(ranking.createdAt)} · Last updated {stamp(ranking.updatedAt)} · {ranking.visibility}</footer></details>)}</div></section>;
}
