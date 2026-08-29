"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RankingHistoryChart } from "./RankingHistoryChart";
import { TeamMark } from "./TeamMark";
import {
  browsePollHref,
  displayRankingPeriod,
  isPrimaryTop25,
  loadBrowsePolls,
  loadBrowseProfileFilters,
  loadBrowseRankingEditors,
  popularPolls,
  saveBrowseRankingOrder,
  type BrowseDemographicFilterCategory,
  type BrowsePoll,
  type BrowsePollPreview,
  type BrowseRankingEditorState,
} from "@/lib/supabase/browsePolls";
import type { RankableEntity } from "@/lib/domain/types";
import { timeAgo } from "@/lib/utils";

function previewEntity(preview: Pick<BrowsePollPreview, "entityId" | "name" | "imageUrl" | "color">, entityType: string): RankableEntity {
  return { id: preview.entityId, entityType, name: preview.name, imageUrl: preview.imageUrl ?? undefined, color: preview.color ?? undefined, attributes: {} };
}

function subjectLabel(entityType: string): string {
  const labels: Record<string, string> = { team: "Teams", stadium: "Stadiums", conference: "Conferences", player: "Players", coach: "Coaches", town: "College towns" };
  return labels[entityType] ?? "Ranking";
}

function rankingActionLabel(poll: BrowsePoll): string {
  if (poll.myResponseStatus === "published") return poll.editable ? "Edit My Ranking" : "View My Ranking";
  if (poll.myResponseStatus === "draft") return poll.editable ? "Continue My Ranking" : "View My Ranking";
  return poll.editable ? "Create My Ranking" : "View Poll";
}

function voteSummary(poll: BrowsePoll, filtersActive: boolean): string {
  const total = `${poll.responseCount} total ${poll.responseCount === 1 ? "ballot" : "ballots"}`;
  if (!filtersActive) return total;
  if (poll.consensusSuppressed) return `${total} · group needs ${poll.minimumCohort}`;
  const selected = poll.selectedResponseCount ?? 0;
  return `${selected} matching ${selected === 1 ? "ballot" : "ballots"} · ${total}`;
}

function ConsensusRows({ poll, rows, prominent = false }: { poll: BrowsePoll; rows: BrowsePollPreview[]; prominent?: boolean }) {
  return <ol className={`browse-consensus-list${prominent ? " is-top25" : ""}`}>
    {rows.map((preview) => <li key={preview.entityId}>
      <b>#{preview.position}</b>
      <TeamMark entity={previewEntity(preview, poll.entityType)} size={prominent ? "medium" : "small"} />
      <strong>{preview.name}</strong>
      <span>{preview.ballotCount}/{poll.selectedResponseCount ?? poll.responseCount} ballots</span>
    </li>)}
  </ol>;
}

function RankingEntryButton({ poll, disabled, onEnter }: { poll: BrowsePoll; disabled: boolean; onEnter: (poll: BrowsePoll) => void }) {
  return <button type="button" className="ranking-entry-button" disabled={disabled} onClick={() => onEnter(poll)}>{disabled ? "Preparing…" : rankingActionLabel(poll)} <span aria-hidden="true">→</span></button>;
}

function PollCard({ poll, filtersActive, editorsReady, entering, onEnter }: {
  poll: BrowsePoll;
  filtersActive: boolean;
  editorsReady: boolean;
  entering: boolean;
  onEnter: (poll: BrowsePoll) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const activityAt = poll.lastResponseAt ?? poll.createdAt;
  const visibleRows = expanded ? poll.preview : poll.preview.slice(0, 5);
  const hasMore = poll.preview.length > 5;
  return <article className="browse-card ranking-view-card">
    <div className="browse-card-topline"><span>{poll.templateKind === "official" ? "OFFICIAL" : "COMMUNITY"}</span><time>{timeAgo(activityAt)}</time></div>
    <div className={`browse-period-status ${poll.myResponseStatus ?? "not-started"}`}><span>{displayRankingPeriod(poll.periodTitle)}</span><b>{poll.editable ? "Current" : "Closed"}</b></div>
    <h3>{poll.title}</h3>
    <p className="poll-creator">By {poll.creatorName}</p>
    <div className="browse-consensus-heading"><span>CONSENSUS</span><strong>{voteSummary(poll, filtersActive)}</strong></div>
    {poll.consensusSuppressed ? <div className="browse-consensus-empty"><strong>More matching voters needed.</strong><span>Switch to All voters or check back after {poll.minimumCohort} people in this group have ranked it.</span></div>
      : poll.preview.length ? <>
        <ConsensusRows poll={poll} rows={visibleRows} />
        {hasMore ? <button type="button" className="ranking-expand-button" onClick={() => setExpanded((current) => !current)}>{expanded ? "Show Less" : `Show #6–#${poll.preview.at(-1)?.position ?? poll.length}`}</button> : null}
      </>
        : <div className="browse-consensus-empty"><strong>No ballots yet.</strong><span>Create your ranking to start the consensus.</span></div>}
    <footer><span>{subjectLabel(poll.entityType)} · Top {poll.length}</span><RankingEntryButton poll={poll} disabled={!editorsReady || entering} onEnter={onEnter} /></footer>
  </article>;
}

export function ConsensusExplorer() {
  const router = useRouter();
  const [polls, setPolls] = useState<BrowsePoll[]>([]);
  const [filterCategories, setFilterCategories] = useState<BrowseDemographicFilterCategory[]>([]);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [rankingEditors, setRankingEditors] = useState<Map<string, BrowseRankingEditorState>>(new Map());
  const [editorsReady, setEditorsReady] = useState(false);
  const [enteringPollId, setEnteringPollId] = useState<string | null>(null);
  const [rankingMessage, setRankingMessage] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [state, setState] = useState<"loading" | "updating" | "ready" | "unavailable">("loading");
  const requestedFilterIds = useMemo(() => Object.values(activeFilters).filter(Boolean), [activeFilters]);

  useEffect(() => {
    let active = true;
    void loadBrowseProfileFilters().then((categories) => { if (active) setFilterCategories(categories); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void loadBrowsePolls(requestedFilterIds).then(async (items) => {
      if (!active) return;
      setPolls(items);
      setState("ready");
      const editors = await loadBrowseRankingEditors(items).catch(() => new Map<string, BrowseRankingEditorState>());
      if (active) {
        setRankingEditors(editors);
        setEditorsReady(true);
      }
    }).catch(() => { if (active) { setState("unavailable"); setEditorsReady(true); } });
    return () => { active = false; };
  }, [requestedFilterIds]);

  const primaryTop25 = polls.find(isPrimaryTop25) ?? null;
  const matches = useMemo(() => polls.filter((poll) => !isPrimaryTop25(poll) && `${poll.title} ${poll.creatorName} ${poll.description ?? ""} ${poll.entityType}`.toLowerCase().includes(deferredQuery)), [deferredQuery, polls]);
  const community = popularPolls(matches);
  const filtersActive = requestedFilterIds.length > 0;

  function setCategoryFilter(categoryId: string, filterId: string) {
    setState("updating");
    setEditorsReady(false);
    setActiveFilters((current) => {
      const next = { ...current };
      if (filterId) next[categoryId] = filterId;
      else delete next[categoryId];
      return next;
    });
  }

  async function enterRanking(poll: BrowsePoll) {
    if (enteringPollId) return;
    const href = browsePollHref(poll);
    const editor = rankingEditors.get(poll.templateVersionId);
    if (!editor || editor.entityIds.length || !poll.editable || !poll.preview.length) {
      router.push(href);
      return;
    }
    setEnteringPollId(poll.id);
    setRankingMessage("Creating your saved draft from the current consensus…");
    try {
      const consensusOrder = poll.preview.slice(0, poll.maxLength).map((position) => position.entityId);
      const saved = await saveBrowseRankingOrder(poll, editor, consensusOrder);
      setRankingEditors((current) => new Map(current).set(poll.templateVersionId, saved));
      router.push(href);
    } catch {
      setRankingMessage("Your ranking could not be created. Try again.");
      setEnteringPollId(null);
    }
  }

  return <main className="browse-page rankings-page shell">
    {state === "loading" ? <div className="browse-empty rankings-loading"><strong>Loading the current Top 25…</strong></div> : null}
    {state === "unavailable" ? <div className="browse-empty rankings-loading"><strong>Rankings are unavailable.</strong><p>Try again shortly.</p></div> : null}

    {primaryTop25 ? <section className="top25-hero" aria-labelledby="top25-heading">
      <header>
        <div><p className="kicker">CURRENT COMMUNITY RANKING</p><h1 id="top25-heading">Top 25 <span>— {displayRankingPeriod(primaryTop25.periodTitle)}</span></h1><p>Consensus from {primaryTop25.selectedResponseCount ?? primaryTop25.responseCount} {filtersActive ? "matching " : ""}ballots.</p></div>
        <div className="top25-hero-actions">
          <button type="button" className={`history-toggle${showHistory ? " is-active" : ""}`} disabled={primaryTop25.history.length < 2} onClick={() => setShowHistory((current) => !current)}>{showHistory ? "Hide Movement" : "View 3-Week Movement"}</button>
          <RankingEntryButton poll={primaryTop25} disabled={!editorsReady || enteringPollId === primaryTop25.id} onEnter={(poll) => void enterRanking(poll)} />
        </div>
      </header>
      {primaryTop25.consensusSuppressed ? <div className="browse-consensus-empty"><strong>More matching voters needed.</strong><span>Choose All voters or another demographic group.</span></div>
        : primaryTop25.preview.length ? <ConsensusRows poll={primaryTop25} rows={primaryTop25.preview.slice(0, 25)} prominent />
          : <div className="browse-consensus-empty top25-empty"><strong>The current Top 25 starts with the first ballot.</strong><span>Create yours now.</span></div>}
      {showHistory ? <RankingHistoryChart periods={primaryTop25.history} /> : null}
    </section> : null}

    {rankingMessage ? <p className="ranking-save-message" role="status">{rankingMessage}</p> : null}

    {(state === "ready" || state === "updating") ? <section className="browse-consensus-controls" aria-label="Consensus filters">
      <div><p className="kicker">FILTER THE CONSENSUS</p><h2>Compare any group</h2><p>Completing a profile category unlocks every value in that category.</p></div>
      <div className="browse-filter-dropdowns" aria-busy={state === "updating"}>
        {filterCategories.map((category) => <label key={category.id}><span>{category.label}</span><select value={activeFilters[category.id] ?? ""} onChange={(event) => setCategoryFilter(category.id, event.target.value)}><option value="">All voters</option>{category.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>)}
        {!filterCategories.length ? <Link href="/profile">Add profile information to unlock demographic filters →</Link> : null}
      </div>
      {filtersActive ? <div className="active-filter-summary"><span>Active:</span>{Object.entries(activeFilters).map(([categoryId, optionId]) => {
        const category = filterCategories.find((item) => item.id === categoryId);
        const option = category?.options.find((item) => item.id === optionId);
        return option ? <button key={categoryId} type="button" onClick={() => setCategoryFilter(categoryId, "")}>{category?.label}: {option.label} ×</button> : null;
      })}<button type="button" onClick={() => { setState("updating"); setEditorsReady(false); setActiveFilters({}); }}>Clear all</button></div> : null}
      {state === "updating" ? <span className="browse-filter-status" role="status">Updating consensus…</span> : null}
    </section> : null}

    {(state === "ready" || state === "updating") ? <section className="other-rankings-heading"><div><p className="kicker">MORE RANKINGS</p><h2>Explore every poll</h2></div><Link className="button button-secondary" href="/create">+ Create poll</Link></section> : null}
    {(state === "ready" || state === "updating") ? <label className="browse-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search polls or creators" />{query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear search">×</button> : null}</label> : null}
    {(state === "ready" || state === "updating") && community.length ? <section className="browse-section"><header><div><p className="kicker">COMMUNITY CONSENSUS</p><h2>{filtersActive ? "Selected voters" : "All voters"}</h2></div><span>{community.length}</span></header><div className="browse-grid">{community.map((poll) => <PollCard key={poll.id} poll={poll} filtersActive={filtersActive} editorsReady={editorsReady} entering={enteringPollId === poll.id} onEnter={(selectedPoll) => void enterRanking(selectedPoll)} />)}</div></section> : null}
    {(state === "ready" || state === "updating") && !community.length ? <div className="browse-empty"><strong>{query ? "No poll matches." : "No other public polls yet."}</strong><p>{query ? "Try another search." : "Create the next one."}</p></div> : null}
  </main>;
}
