"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TeamMark } from "./TeamMark";
import { loadMyRankingHistory, type SavedRankingHistory, type SavedRankingPlacement } from "@/lib/supabase/rankingHistory";
import type { RankableEntity } from "@/lib/domain/types";

function stamp(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function placementEntity(placement: SavedRankingPlacement): RankableEntity {
  return {
    id: `saved:${placement.position}:${placement.name}`,
    entityType: "saved-ranking-item",
    name: placement.name,
    imageUrl: placement.imageUrl ?? undefined,
    color: placement.color ?? undefined,
    attributes: {},
  };
}

function RankingPreview({ placements }: { placements: SavedRankingPlacement[] }) {
  const topThree = placements.slice(0, 3);
  const trail = placements.slice(3, 8);
  if (!placements.length) return <span className="history-preview-empty">Start ranking to see a preview.</span>;
  return <div className="history-ranking-preview" aria-label={`Top three: ${topThree.map((placement) => placement.name).join(", ")}`}>
    <div className="history-podium">{topThree.map((placement) => <span className="history-podium-item" key={placement.position} title={`#${placement.position} ${placement.name}`}><b>#{placement.position}</b><TeamMark entity={placementEntity(placement)} size="medium" /><strong>{placement.name}</strong></span>)}</div>
    {trail.length ? <div className="history-logo-trail" aria-hidden="true">{trail.map((placement) => <TeamMark key={placement.position} entity={placementEntity(placement)} size="small" />)}</div> : null}
  </div>;
}

export function MyRankings() {
  const [rankings, setRankings] = useState<SavedRankingHistory[]>([]);
  const [message, setMessage] = useState("Loading your ranking history…");
  useEffect(() => { void loadMyRankingHistory().then((items) => { setRankings(items); setMessage(items.length ? "" : "Your saved rankings will appear here."); }).catch(() => setMessage("Sign in to see saved drafts and published rankings.")); }, []);
  return <section className="my-rankings-panel" aria-labelledby="my-rankings-title"><div className="my-rankings-heading"><div><p className="kicker">RANKING HISTORY</p><h2 id="my-rankings-title">Your rankings</h2><p>Each period has one saved list. See how every pick changes over time.</p></div><div className="history-heading-actions"><span>{rankings.length} saved</span><Link href="/trends">View trends →</Link></div></div>{message && <p>{message}</p>}<div className="ranking-history-list">{rankings.map((ranking) => <details key={ranking.id}><summary><div className="history-summary-title"><strong>{ranking.title}</strong><span className={`history-status ${ranking.status}`}>{ranking.status}</span>{ranking.periodTitle ? <span className="history-period">{ranking.periodTitle}</span> : null}</div><time>{ranking.status === "published" && ranking.publishedAt ? `Published ${stamp(ranking.publishedAt)}` : `Updated ${stamp(ranking.updatedAt)}`}</time><small>{ranking.placements.length} ranked · revision {ranking.revision}</small><RankingPreview placements={ranking.placements} /></summary><ol>{ranking.placements.map((placement) => <li key={placement.position}><span>{placement.position}</span><TeamMark entity={placementEntity(placement)} size="small" /><strong>{placement.name}</strong></li>)}</ol><footer>{ranking.periodTitle ? `${ranking.periodTitle} · ` : ""}Created {stamp(ranking.createdAt)} · Updated {stamp(ranking.updatedAt)} · {ranking.visibility}</footer></details>)}</div></section>;
}
