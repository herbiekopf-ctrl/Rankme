"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RankingPositionControl } from "./RankingPositionControl";
import { TeamMark } from "./TeamMark";
import { insertEntity, moveEntity } from "@/lib/domain/ranking";
import {
  browsePollHref,
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

function pollAction(poll: BrowsePoll): string {
  if (poll.myResponseStatus === "published") return "Edit your ranking";
  if (poll.myResponseStatus === "draft") return "Continue your draft";
  return poll.responseCadence === "weekly" ? "Rank this week" : "Add your ranking";
}

function voteSummary(poll: BrowsePoll, filtersActive: boolean): string {
  const total = `${poll.responseCount} total ${poll.responseCount === 1 ? "ballot" : "ballots"}`;
  if (!filtersActive) return total;
  if (poll.consensusSuppressed) return `${total} · group needs ${poll.minimumCohort}`;
  const selected = poll.selectedResponseCount ?? 0;
  return `${selected} matching ${selected === 1 ? "ballot" : "ballots"} · ${total}`;
}

function ConsensusRows({ poll, rows, editor, saving, onChange }: {
  poll: BrowsePoll;
  rows: BrowsePollPreview[];
  editor?: BrowseRankingEditorState;
  saving: boolean;
  onChange: (entityIds: string[]) => void;
}) {
  return <ol className="browse-consensus-list">
    {rows.map((preview) => {
      const currentIndex = editor?.entityIds.indexOf(preview.entityId) ?? -1;
      const currentRank = currentIndex >= 0 ? currentIndex + 1 : null;
      return <li key={preview.entityId}>
        <b>#{preview.position}</b>
        <TeamMark entity={previewEntity(preview, poll.entityType)} size="small" />
        <strong>{preview.name}</strong>
        <span>{preview.ballotCount}/{poll.selectedResponseCount ?? poll.responseCount} ballots</span>
        {editor ? <RankingPositionControl
          entityName={preview.name}
          currentRank={currentRank}
          rankingLength={editor.entityIds.length}
          maxLength={poll.maxLength}
          disabled={!poll.editable}
          saving={saving}
          onAdd={(position) => onChange(insertEntity(editor.entityIds, preview.entityId, position, poll.maxLength))}
          onMove={(position) => onChange(moveEntity(editor.entityIds, preview.entityId, position))}
        /> : <Link className="consensus-rank-link" href={browsePollHref(poll)}>Rank</Link>}
      </li>;
    })}
  </ol>;
}

function PollCard({ poll, filtersActive, editor, saving, onRankingChange }: {
  poll: BrowsePoll;
  filtersActive: boolean;
  editor?: BrowseRankingEditorState;
  saving: boolean;
  onRankingChange: (entityIds: string[]) => void;
}) {
  const activityAt = poll.lastResponseAt ?? poll.createdAt;
  const href = browsePollHref(poll);
  const topFive = poll.preview.slice(0, 5);
  const remaining = poll.preview.slice(5);
  return <article className="browse-card">
    <div className="browse-card-topline"><span>{poll.templateKind === "official" ? "OFFICIAL" : "COMMUNITY"}</span><time>{timeAgo(activityAt)}</time></div>
    <div className={`browse-period-status ${poll.myResponseStatus ?? "not-started"}`}><span>{poll.periodTitle}</span><b>{poll.myResponseStatus === "published" ? "✓ Ranked" : poll.myResponseStatus === "draft" ? "Draft" : poll.editable ? "Open" : "Closed"}</b></div>
    <h3>{poll.title}</h3>
    <p className="poll-creator">By {poll.creatorName}</p>
    <p>{poll.description || `Choose your top ${poll.length}.`}</p>
    <div className="browse-consensus-heading"><span>CONSENSUS</span><strong>{voteSummary(poll, filtersActive)}</strong></div>
    {poll.consensusSuppressed ? <div className="browse-consensus-empty"><strong>More matching voters needed.</strong><span>Switch to All voters or check back after {poll.minimumCohort} people in this group have ranked it.</span></div>
      : topFive.length ? <>
        <ConsensusRows poll={poll} rows={topFive} editor={editor} saving={saving} onChange={onRankingChange} />
        {remaining.length ? <details className="browse-full-consensus"><summary>Show #6–#{poll.preview.at(-1)?.position ?? poll.length}</summary><ConsensusRows poll={poll} rows={remaining} editor={editor} saving={saving} onChange={onRankingChange} /></details> : null}
      </>
        : <div className="browse-consensus-empty"><strong>No ballots yet.</strong><span>Your published ranking starts the consensus.</span></div>}
    <footer><span>{subjectLabel(poll.entityType)} · Top {poll.length}</span><Link href={href}>{pollAction(poll)} →</Link></footer>
  </article>;
}

export function ConsensusExplorer() {
  const [polls, setPolls] = useState<BrowsePoll[]>([]);
  const [filterCategories, setFilterCategories] = useState<BrowseDemographicFilterCategory[]>([]);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [rankingEditors, setRankingEditors] = useState<Map<string, BrowseRankingEditorState>>(new Map());
  const [savingPolls, setSavingPolls] = useState<Set<string>>(new Set());
  const [rankingMessage, setRankingMessage] = useState("");
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
      if (active) setRankingEditors(editors);
    }).catch(() => { if (active) setState("unavailable"); });
    return () => { active = false; };
  }, [requestedFilterIds]);

  const matches = useMemo(() => polls.filter((poll) => `${poll.title} ${poll.creatorName} ${poll.description ?? ""} ${poll.entityType}`.toLowerCase().includes(deferredQuery)), [deferredQuery, polls]);
  const community = popularPolls(matches);
  const filtersActive = requestedFilterIds.length > 0;

  function setCategoryFilter(categoryId: string, filterId: string) {
    setState("updating");
    setActiveFilters((current) => {
      const next = { ...current };
      if (filterId) next[categoryId] = filterId;
      else delete next[categoryId];
      return next;
    });
  }

  async function updateRanking(poll: BrowsePoll, entityIds: string[]) {
    const previous = rankingEditors.get(poll.templateVersionId);
    if (!previous || savingPolls.has(poll.templateVersionId)) return;
    setRankingMessage("");
    setRankingEditors((current) => new Map(current).set(poll.templateVersionId, { ...previous, entityIds }));
    setSavingPolls((current) => new Set(current).add(poll.templateVersionId));
    try {
      const saved = await saveBrowseRankingOrder(poll, previous, entityIds);
      setRankingEditors((current) => new Map(current).set(poll.templateVersionId, saved));
      setRankingMessage(saved.status === "published" ? "Ranking updated. Your previous revision is preserved." : "Draft saved.");
    } catch {
      setRankingEditors((current) => new Map(current).set(poll.templateVersionId, previous));
      setRankingMessage("That ranking change could not be saved.");
    } finally {
      setSavingPolls((current) => { const next = new Set(current); next.delete(poll.templateVersionId); return next; });
    }
  }

  return <main className="browse-page rankings-page shell">
    <section className="browse-heading"><div><p className="kicker">RANKINGS</p><h1>What does everyone think?</h1><p>See every poll&apos;s consensus, compare groups, and adjust your own ranking without losing your place.</p></div><Link className="button button-primary" href="/create">+ Create poll</Link></section>

    <section className="browse-consensus-controls" aria-label="Consensus filters">
      <div><p className="kicker">WHOSE RANKINGS?</p><h2>Compare any group</h2><p>Each profile category you complete unlocks every option in that category.</p></div>
      <div className="browse-filter-dropdowns" aria-busy={state === "updating"}>
        {filterCategories.map((category) => <label key={category.id}><span>{category.label}</span><select value={activeFilters[category.id] ?? ""} onChange={(event) => setCategoryFilter(category.id, event.target.value)}><option value="">All voters</option>{category.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>)}
        {!filterCategories.length ? <Link href="/profile">Add profile information to unlock demographic filters →</Link> : null}
      </div>
      {filtersActive ? <div className="active-filter-summary"><span>Active:</span>{Object.entries(activeFilters).map(([categoryId, optionId]) => {
        const category = filterCategories.find((item) => item.id === categoryId);
        const option = category?.options.find((item) => item.id === optionId);
        return option ? <button key={categoryId} type="button" onClick={() => setCategoryFilter(categoryId, "")}>{category?.label}: {option.label} ×</button> : null;
      })}<button type="button" onClick={() => { setState("updating"); setActiveFilters({}); }}>Clear all</button></div> : null}
      {state === "updating" ? <span className="browse-filter-status" role="status">Updating consensus…</span> : null}
    </section>

    <label className="browse-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search polls or creators" />{query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear search">×</button> : null}</label>
    {rankingMessage ? <p className="ranking-save-message" role="status">{rankingMessage}</p> : null}
    {state === "loading" ? <div className="browse-empty"><strong>Loading rankings…</strong></div> : null}
    {state === "unavailable" ? <div className="browse-empty"><strong>Rankings are unavailable.</strong><p>Try again shortly.</p></div> : null}
    {(state === "ready" || state === "updating") && matches.length ? <section className="browse-section"><header><div><p className="kicker">COMMUNITY CONSENSUS</p><h2>{filtersActive ? "Selected voters" : "All voters"}</h2></div><span>{community.length}</span></header><div className="browse-grid">{community.map((poll) => <PollCard key={poll.id} poll={poll} filtersActive={filtersActive} editor={rankingEditors.get(poll.templateVersionId)} saving={savingPolls.has(poll.templateVersionId)} onRankingChange={(entityIds) => void updateRanking(poll, entityIds)} />)}</div></section> : null}
    {(state === "ready" || state === "updating") && !matches.length ? <div className="browse-empty"><strong>{query ? "No poll matches." : "No public polls yet."}</strong><p>{query ? "Try another search." : "Create the first one."}</p></div> : null}
  </main>;
}
