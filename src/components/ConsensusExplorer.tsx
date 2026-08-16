"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TeamMark } from "./TeamMark";
import {
  browsePollHref,
  loadBrowseFilterCatalog,
  loadBrowsePolls,
  participatedPolls,
  popularPolls,
  type BrowseDemographicCategory,
  type BrowseDemographicOption,
  type BrowsePoll,
  type BrowsePollPreview,
} from "@/lib/supabase/browsePolls";
import type { RankableEntity } from "@/lib/domain/types";
import { timeAgo } from "@/lib/utils";

function previewEntity(preview: Pick<BrowsePollPreview, "canonicalKey" | "name" | "imageUrl" | "color">, entityType: string): RankableEntity {
  return {
    id: preview.canonicalKey,
    entityType,
    name: preview.name,
    imageUrl: preview.imageUrl ?? undefined,
    color: preview.color ?? undefined,
    attributes: {},
  };
}

function filterEntity(option: BrowseDemographicOption): RankableEntity | null {
  if (!option.entityType) return null;
  return {
    id: option.id,
    entityType: option.entityType,
    name: option.label,
    imageUrl: option.imageUrl ?? undefined,
    color: option.color ?? undefined,
    attributes: {},
  };
}

function subjectLabel(entityType: string): string {
  const labels: Record<string, string> = { team: "Teams", stadium: "Stadiums", conference: "Conferences", player: "Players", coach: "Coaches", town: "College towns" };
  return labels[entityType] ?? "Ranking";
}

function pollAction(poll: BrowsePoll): string {
  if (poll.myResponseStatus === "published") return "Edit your ranking";
  if (poll.myResponseStatus === "draft") return "Continue your draft";
  return poll.responseCadence === "weekly" ? "Rank this week" : "Add your ranking";
}

function voteSummary(poll: BrowsePoll, filtersActive: boolean): string {
  const total = `${poll.responseCount} total ${poll.responseCount === 1 ? "voter" : "voters"}`;
  if (!filtersActive) return total;
  if (poll.consensusSuppressed) return `${total} · this view needs ${poll.minimumCohort}`;
  const selected = poll.selectedResponseCount ?? 0;
  return `${selected} matching ${selected === 1 ? "voter" : "voters"} · ${total}`;
}

function ConsensusRows({ poll, compact = false }: { poll: BrowsePoll; compact?: boolean }) {
  const rows = compact ? poll.preview.slice(0, 3) : poll.preview;
  return <ol className={compact ? "browse-consensus-list is-compact" : "browse-consensus-list"}>
    {rows.map((preview) => <li key={preview.canonicalKey}>
      <b>#{preview.position}</b>
      <TeamMark entity={previewEntity(preview, poll.entityType)} size={compact ? "small" : "medium"} />
      <strong>{preview.name}</strong>
      <span>{preview.ballotCount}/{poll.selectedResponseCount ?? poll.responseCount} ballots</span>
    </li>)}
  </ol>;
}

function PollCard({ poll, filtersActive }: { poll: BrowsePoll; filtersActive: boolean }) {
  const activityAt = poll.lastResponseAt ?? poll.createdAt;
  const href = browsePollHref(poll);
  return <article className="browse-card">
    <div className="browse-card-topline"><span>{poll.templateKind === "official" ? "OFFICIAL" : "COMMUNITY"}</span><time>{timeAgo(activityAt)}</time></div>
    <div className={`browse-period-status ${poll.myResponseStatus ?? "not-started"}`}><span>{poll.periodTitle}</span><b>{poll.myResponseStatus === "published" ? "✓ Ranked" : poll.myResponseStatus === "draft" ? "Draft" : "Open"}</b></div>
    <h3>{poll.title}</h3>
    <p>{poll.description || `Choose your top ${poll.length}.`}</p>
    <div className="browse-consensus-heading"><span>CONSENSUS</span><strong>{voteSummary(poll, filtersActive)}</strong></div>
    {poll.consensusSuppressed ? <div className="browse-consensus-empty"><strong>More matching voters needed.</strong><span>Switch to All voters or check back after {poll.minimumCohort} people in this group have ranked it.</span></div>
      : poll.preview.length ? <>
        <ConsensusRows poll={poll} compact />
        {poll.preview.length > 3 ? <details className="browse-full-consensus"><summary>See full consensus</summary><ConsensusRows poll={poll} /></details> : null}
      </>
        : <div className="browse-consensus-empty"><strong>Be the first voter.</strong><span>Your published ranking starts the consensus.</span></div>}
    <footer>
      <span>{subjectLabel(poll.entityType)} · Top {poll.length}</span>
      <Link href={href}>{pollAction(poll)} →</Link>
    </footer>
  </article>;
}

export function ConsensusExplorer() {
  const [polls, setPolls] = useState<BrowsePoll[]>([]);
  const [filterCategories, setFilterCategories] = useState<BrowseDemographicCategory[]>([]);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [state, setState] = useState<"loading" | "updating" | "ready" | "unavailable">("loading");
  const filterKey = JSON.stringify(Object.entries(activeFilters).filter(([, optionId]) => Boolean(optionId)).sort(([left], [right]) => left.localeCompare(right)));
  const requestedFilters = useMemo(() => (JSON.parse(filterKey) as Array<[string, string]>).map(([categoryId, optionId]) => ({ categoryId, optionId })), [filterKey]);

  useEffect(() => {
    let active = true;
    void loadBrowseFilterCatalog()
      .then((categories) => { if (active) setFilterCategories(categories); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void loadBrowsePolls(requestedFilters)
      .then((items) => { if (active) { setPolls(items); setState("ready"); } })
      .catch(() => { if (active) setState("unavailable"); });
    return () => { active = false; };
  }, [requestedFilters]);

  const matches = useMemo(() => polls.filter((poll) => `${poll.title} ${poll.description ?? ""} ${poll.entityType}`.toLowerCase().includes(deferredQuery)), [deferredQuery, polls]);
  const mine = participatedPolls(matches);
  const community = popularPolls(matches);
  const filtersActive = requestedFilters.length > 0;

  function selectFilter(categoryId: string, optionId: string) {
    if ((activeFilters[categoryId] ?? "") === optionId) return;
    setState("updating");
    setActiveFilters((current) => {
      if (!optionId) {
        const next = { ...current };
        delete next[categoryId];
        return next;
      }
      return { ...current, [categoryId]: optionId };
    });
  }

  return <main className="browse-page shell">
    <section className="browse-heading"><div><p className="kicker">BROWSE</p><h1>See what everyone thinks.</h1><p>Open a poll, compare the consensus, then add or revise your ranking.</p></div><Link className="button button-primary" href="/create">+ Create poll</Link></section>

    <section className="browse-consensus-controls" aria-label="Consensus filters">
      <div><p className="kicker">WHOSE CONSENSUS?</p><h2>Compare voter groups</h2><p>Completing a profile category unlocks every choice in that category.</p></div>
      <div className="browse-filter-panel" aria-busy={state === "updating"}>
        <button type="button" className={`browse-all-voters ${!filtersActive ? "is-active" : ""}`} aria-pressed={!filtersActive} onClick={() => { if (filtersActive) setState("updating"); setActiveFilters({}); }}>All voters</button>
        <div className="browse-filter-fields">
          {filterCategories.map((category) => {
            const selectedOption = category.options.find((option) => option.id === activeFilters[category.id]);
            const entity = selectedOption ? filterEntity(selectedOption) : null;
            return <label key={category.id}><span>{category.label}</span><div>{entity ? <TeamMark entity={entity} size="small" /> : null}<select value={activeFilters[category.id] ?? ""} onChange={(event) => selectFilter(category.id, event.target.value)}><option value="">Any</option>{category.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div></label>;
          })}
        </div>
        {!filterCategories.length ? <Link className="browse-add-profile" href="/profile">Add profile categories →</Link> : null}
      </div>
      {state === "updating" ? <span className="browse-filter-status" role="status">Updating consensus…</span> : null}
    </section>

    <label className="browse-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search polls" />{query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear search">×</button> : null}</label>

    {state === "loading" && <div className="browse-empty"><strong>Loading consensus…</strong></div>}
    {state === "unavailable" && <div className="browse-empty"><strong>Consensus is unavailable.</strong><p>Try again shortly.</p></div>}
    {(state === "ready" || state === "updating") && matches.length ? <div className="browse-sections">
      {mine.length ? <section className="browse-section browse-mine"><header><div><p className="kicker">YOUR RANKINGS</p><h2>Continue or revise</h2></div><span>{mine.length}</span></header><div className="browse-your-strip">{mine.map((poll) => <Link key={poll.id} href={browsePollHref(poll)}><span>{poll.periodTitle}</span><strong>{poll.title}</strong><small>{poll.myResponseStatus === "published" ? "Edit ranking →" : "Continue draft →"}</small></Link>)}</div></section> : null}
      <section className="browse-section"><header><div><p className="kicker">COMMUNITY CONSENSUS</p><h2>{filtersActive ? "Filtered consensus" : "All voters"}</h2></div><span>{community.length}</span></header><div className="browse-grid">{community.map((poll) => <PollCard key={poll.id} poll={poll} filtersActive={filtersActive} />)}</div></section>
    </div> : null}
    {(state === "ready" || state === "updating") && !matches.length && <div className="browse-empty"><strong>{query ? "No poll matches." : "No public polls yet."}</strong><p>{query ? "Try another search." : "Create the first one."}</p></div>}
  </main>;
}
