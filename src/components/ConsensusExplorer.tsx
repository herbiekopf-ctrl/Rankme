"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TeamMark } from "./TeamMark";
import { browsePollHref, loadBrowsePolls, popularPolls, recentPolls, type BrowsePoll, type BrowsePollPreview } from "@/lib/supabase/browsePolls";
import type { RankableEntity } from "@/lib/domain/types";
import { timeAgo } from "@/lib/utils";

function previewEntity(preview: BrowsePollPreview, entityType: string): RankableEntity {
  return {
    id: preview.canonicalKey,
    entityType,
    name: preview.name,
    imageUrl: preview.imageUrl ?? undefined,
    color: preview.color ?? undefined,
    attributes: {},
  };
}

function subjectLabel(entityType: string): string {
  const labels: Record<string, string> = { team: "Teams", stadium: "Stadiums", conference: "Conferences", player: "Players", coach: "Coaches", town: "College towns" };
  return labels[entityType] ?? "Ranking";
}

function PollCard({ poll }: { poll: BrowsePoll }) {
  const activityAt = poll.lastResponseAt ?? poll.createdAt;
  return <Link className="browse-card" href={browsePollHref(poll)} aria-label={`Rank ${poll.title}`}>
    <div className="browse-card-topline"><span>{poll.templateKind === "official" ? "OFFICIAL" : "COMMUNITY"}</span><time>{timeAgo(activityAt)}</time></div>
    <h3>{poll.title}</h3>
    <p>{poll.description || `Choose your top ${poll.length}.`}</p>
    {poll.preview.length ? <div className="browse-poll-preview" aria-label="Latest top three">{poll.preview.slice(0, 3).map((preview) => <span key={preview.position}><b>#{preview.position}</b><TeamMark entity={previewEntity(preview, poll.entityType)} size="medium" /><strong>{preview.name}</strong></span>)}</div> : <div className="browse-poll-preview is-empty"><span>Be first to publish.</span></div>}
    <footer><span>{subjectLabel(poll.entityType)} · Top {poll.length}</span><span>{poll.responseCount} {poll.responseCount === 1 ? "ranking" : "rankings"}</span><strong>Rank this poll →</strong></footer>
  </Link>;
}

export function ConsensusExplorer() {
  const [polls, setPolls] = useState<BrowsePoll[]>([]);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    let active = true;
    void loadBrowsePolls()
      .then((items) => { if (active) { setPolls(items); setState("ready"); } })
      .catch(() => { if (active) setState("unavailable"); });
    return () => { active = false; };
  }, []);

  const matches = useMemo(() => polls.filter((poll) => `${poll.title} ${poll.description ?? ""} ${poll.entityType}`.toLowerCase().includes(deferredQuery)), [deferredQuery, polls]);
  const recent = recentPolls(matches);
  const popular = popularPolls(matches).filter((poll) => poll.responseCount > 0);

  return <main className="browse-page shell">
    <section className="browse-heading"><div><p className="kicker">BROWSE</p><h1>Find a poll. Make it yours.</h1><p>Open any poll and rank it.</p></div><Link className="button button-primary" href="/create">+ Create poll</Link></section>
    <label className="browse-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search polls" />{query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear search">×</button> : null}</label>

    {state === "loading" && <div className="browse-empty"><strong>Loading polls…</strong></div>}
    {state === "unavailable" && <div className="browse-empty"><strong>Browse is unavailable.</strong><p>Try again shortly.</p></div>}
    {state === "ready" && matches.length ? <div className="browse-sections">
      <section id="popular" className="browse-section"><header><div><p className="kicker">POPULAR</p><h2>Most ranked</h2></div><span>{popular.length}</span></header><div className="browse-grid">{popular.map((poll) => <PollCard key={`popular-${poll.id}`} poll={poll} />)}</div></section>
      <section id="recent" className="browse-section"><header><div><p className="kicker">RECENT</p><h2>Fresh polls</h2></div><span>{recent.length}</span></header><div className="browse-grid">{recent.map((poll) => <PollCard key={`recent-${poll.id}`} poll={poll} />)}</div></section>
    </div> : null}
    {state === "ready" && !matches.length && <div className="browse-empty"><strong>{query ? "No poll matches." : "No public polls yet."}</strong><p>{query ? "Try another search." : "Create the first one."}</p></div>}
  </main>;
}
