"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ComparisonTool } from "./ComparisonTool";
import { SignInGate } from "./SignInGate";
import { SortableEntityCard } from "./SortableEntityCard";
import { TeamMark } from "./TeamMark";
import { encodeCustomPollConfig } from "@/lib/domain/customPolls";
import { encodeRanking, insertEntity, moveEntity, removeEntity, validateRanking } from "@/lib/domain/ranking";
import type { CustomPollConfig, DatasetEnvelope, RankableEntity, RankingDraft, RankingTemplate } from "@/lib/domain/types";
import { entityMatches, formatAttribute, timeAgo } from "@/lib/utils";
import { persistBuiltInRankingDraft, persistCustomPoll, persistRankingDraft, publishPersistedRanking } from "@/lib/supabase/community";
import { getBrowserSupabaseClient, getRankedUser, isPermanentRankedUser } from "@/lib/supabase/browser";
import type { User } from "@supabase/supabase-js";

type HistoryState = { past: string[][]; present: string[]; future: string[][] };

export function RankingBuilder({
  template,
  initialDataset,
  customConfig,
}: {
  template: RankingTemplate;
  initialDataset: DatasetEnvelope;
  customConfig?: CustomPollConfig;
}) {
  const router = useRouter();
  const dataset = initialDataset;
  const [history, setHistory] = useState<HistoryState>({ past: [], present: [], future: [] });
  const [query, setQuery] = useState("");
  const [conference, setConference] = useState("All");
  const [candidateSort, setCandidateSort] = useState("name");
  const [saveState, setSaveState] = useState<"loading" | "saving" | "saved" | "cloud">("loading");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [rankedUser, setRankedUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [effectiveConfig, setEffectiveConfig] = useState(customConfig);
  const hydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storageKey = `ranked:draft:${template.id}`;

  useEffect(() => {
    const client = getBrowserSupabaseClient();
    if (!client) {
      Promise.resolve().then(() => setAuthReady(true));
      return;
    }
    let active = true;
    getRankedUser(client).then((user) => { if (active) setRankedUser(user); }).catch(() => undefined).finally(() => { if (active) setAuthReady(true); });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setRankedUser(session?.user ?? null);
      setAuthReady(true);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const draft = JSON.parse(saved) as RankingDraft;
        if (draft.templateId === template.id && Array.isArray(draft.entityIds)) {
          setHistory({ past: [], present: [...new Set(draft.entityIds)].slice(0, template.maxLength), future: [] });
        }
      }
    } finally {
      hydrated.current = true;
      setSaveState("saved");
    }
  }, [storageKey, template.id, template.maxLength]);

  useEffect(() => {
    if (!hydrated.current) return;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const draft: RankingDraft = {
        id: `local-${template.id}`,
        templateId: template.id,
        templateVersion: template.version,
        datasetVersion: dataset.version,
        revision: history.past.length,
        entityIds: history.present,
        updatedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(storageKey, JSON.stringify(draft));
      if (effectiveConfig?.remoteTemplateVersionId && isPermanentRankedUser(rankedUser)) {
        persistRankingDraft(effectiveConfig, dataset, history.present)
          .then(() => setSaveState("cloud"))
          .catch(() => setSaveState("saved"));
      } else {
        setSaveState("saved");
      }
    }, 350);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [dataset, dataset.version, effectiveConfig, history.past.length, history.present, rankedUser, storageKey, template.id, template.version]);

  const entitiesById = useMemo(() => new Map(dataset.entities.map((entity) => [entity.id, entity])), [dataset.entities]);
  const rankedEntities = history.present.map((id) => entitiesById.get(id)).filter((entity): entity is RankableEntity => Boolean(entity));
  const rankedSet = useMemo(() => new Set(history.present), [history.present]);
  const conferences = [...new Set(dataset.entities.map((entity) => String(entity.attributes.conference ?? "Other")))].sort();
  const candidates = useMemo(() => {
    const options = dataset.entities.filter((entity) =>
      !rankedSet.has(entity.id) &&
      entityMatches(entity, query) &&
      (conference === "All" || entity.attributes.conference === conference),
    );
    if (candidateSort === "name") return options.sort((a, b) => a.name.localeCompare(b.name));
    const metric = dataset.metricDefinitions?.find((definition) => definition.key === candidateSort);
    if (!metric) return options;
    return options.sort((a, b) => {
      const left = typeof a.attributes[candidateSort] === "number" ? a.attributes[candidateSort] as number : null;
      const right = typeof b.attributes[candidateSort] === "number" ? b.attributes[candidateSort] as number : null;
      if (left == null) return 1;
      if (right == null) return -1;
      return metric.direction === "asc" ? left - right : right - left;
    });
  }, [candidateSort, conference, dataset.entities, dataset.metricDefinitions, query, rankedSet]);
  const validationErrors = validateRanking(template, history.present);
  const remaining = Math.max(0, template.defaultLength - history.present.length);
  const sourceBadge = dataset.connected ? "Real CFBD data connected" : "Real data not imported";
  const detailEntity = detailId ? entitiesById.get(detailId) : undefined;

  function commit(next: string[]) {
    if (next.join("|") === history.present.join("|")) return;
    setHistory((current) => ({ past: [...current.past, current.present].slice(-50), present: next, future: [] }));
  }

  function undo() {
    setHistory((current) => {
      const previous = current.past.at(-1);
      return previous ? { past: current.past.slice(0, -1), present: previous, future: [current.present, ...current.future] } : current;
    });
  }

  function redo() {
    setHistory((current) => {
      const next = current.future[0];
      return next ? { past: [...current.past, current.present], present: next, future: current.future.slice(1) } : current;
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const toIndex = history.present.indexOf(String(over.id));
    commit(moveEntity(history.present, String(active.id), toIndex));
  }

  function toggleCompare(id: string) {
    setCompareIds((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 4 ? [...current, id] : [...current.slice(1), id]);
    setCompareOpen(true);
  }

  const customQuery = effectiveConfig ? `&config=${encodeCustomPollConfig(effectiveConfig)}` : "";
  const sharePath = `/ballot/${customConfig ? "custom-poll" : "preseason-2026"}?template=${customConfig ? "custom" : template.id}&items=${encodeRanking(history.present)}${customQuery}`;
  async function copyShareLink() {
    await navigator.clipboard.writeText(`${window.location.origin}${sharePath}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  async function publishRanking() {
    setPublishing(true);
    setPublishError("");
    try {
      let rankingId: string;
      if (effectiveConfig) {
        const remoteConfig = await persistCustomPoll(effectiveConfig, dataset);
        setEffectiveConfig(remoteConfig);
        window.localStorage.setItem(`ranked:custom-poll:${remoteConfig.id}`, JSON.stringify(remoteConfig));
        rankingId = await persistRankingDraft(remoteConfig, dataset, history.present);
      } else {
        rankingId = await persistBuiltInRankingDraft(template, dataset, history.present, 2026);
      }
      await publishPersistedRanking(rankingId);
      router.push(sharePath);
    } catch (reason) {
      setPublishError(reason instanceof Error ? reason.message : "The relational ballot could not be published.");
      setPublishing(false);
    }
  }

  return (
    <div className="builder-page">
      <section className="builder-heading shell">
        <div>
          <Link className="back-link" href={customConfig ? "/create" : "/"}>← {customConfig ? "Create another poll" : "Back to home"}</Link>
          <p className="kicker">{template.eyebrow}</p>
          <h1>{template.title}</h1>
          <p>{template.description}</p>
        </div>
        <div className="builder-meta">
          <span className={dataset.source === "collegefootballdata" ? "data-badge is-live" : "data-badge"}>{sourceBadge}</span>
          <small>{dataset.sourceLabel} · {dataset.entities.length} options · updated {timeAgo(dataset.refreshedAt)}</small>
          {dataset.source === "collegefootballdata" && dataset.upstreamRequests && <small>One shared snapshot · {dataset.upstreamRequests} source calls · zero per-user CFBD calls</small>}
          {dataset.warnings?.map((warning) => <strong className="stale-warning" key={warning}>{warning}</strong>)}
          {dataset.stale && <strong className="stale-warning">No invented fallback is shown. Initialize or repair the real-data import.</strong>}
        </div>
      </section>

      <section className="builder-shell shell">
        {!dataset.entities.length && <div className="builder-empty-state"><p className="kicker">REAL DATA REQUIRED</p><h2>This ranking has no imported options yet.</h2><p>Run the protected CFBD import. Ranked will not replace missing data with invented teams, players, statistics, or results.</p></div>}
        <div className="builder-toolbar">
          <div className="draft-status"><span className={saveState === "saving" ? "saving-dot" : "saved-dot"} />{saveState === "loading" ? "Opening draft" : saveState === "saving" ? "Saving" : saveState === "cloud" ? "Relational draft saved" : "Local draft saved"}</div>
          <div className="toolbar-actions">
            {!!dataset.metricDefinitions?.length && <button className={compareOpen ? "comparison-toggle active" : "comparison-toggle"} onClick={() => setCompareOpen((open) => !open)}>⇄ Compare data</button>}
            <button onClick={undo} disabled={!history.past.length}>↶ Undo</button>
            <button onClick={redo} disabled={!history.future.length}>↷ Redo</button>
            <button className="publish-button" disabled={validationErrors.length > 0} onClick={() => setPublishOpen(true)}>{template.publishLabel}</button>
          </div>
        </div>

        {compareOpen && !!dataset.metricDefinitions?.length && (
          <ComparisonTool dataset={dataset} selectedIds={compareIds} onSelectedIdsChange={setCompareIds} onClose={() => setCompareOpen(false)} />
        )}

        <div className="builder-grid">
          <section className="ranking-panel" aria-labelledby="your-ranking-heading">
            <div className="panel-heading">
              <div><span>YOUR BALLOT</span><h2 id="your-ranking-heading">{history.present.length} of {template.defaultLength} ranked</h2></div>
              <div className="completion-ring" style={{ "--progress": `${(history.present.length / template.defaultLength) * 360}deg` } as React.CSSProperties}><span>{history.present.length}</span></div>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={history.present} strategy={verticalListSortingStrategy}>
                <div className="ranking-list">
                  {rankedEntities.map((entity, index) => (
                    <SortableEntityCard
                      key={entity.id}
                      entity={entity}
                      rank={index + 1}
                      template={template}
                      onMove={(direction) => commit(moveEntity(history.present, entity.id, index + direction))}
                      onRemove={() => commit(removeEntity(history.present, entity.id))}
                      onCompare={dataset.metricDefinitions?.length ? () => toggleCompare(entity.id) : undefined}
                    />
                  ))}
                  {Array.from({ length: Math.min(remaining, history.present.length ? 3 : 5) }, (_, index) => (
                    <div className="empty-rank" key={index}><span>{history.present.length + index + 1}</span><p>{history.present.length ? "Drop or add the next pick" : "Add an option from the candidate pool"}</p></div>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            {remaining > 3 && history.present.length > 0 && <p className="remaining-note">+ {remaining - 3} more open spots</p>}
          </section>

          <section className="candidate-panel" aria-labelledby="candidate-heading">
            <div className="candidate-sticky">
              <div className="panel-heading compact">
                <div><span>CANDIDATE POOL</span><h2 id="candidate-heading">Make your case</h2></div>
                <span className="candidate-count">{candidates.length}</span>
              </div>
              <label className="search-box">
                <span aria-hidden="true">⌕</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={template.searchPlaceholder} />
                {query && <button onClick={() => setQuery("")} aria-label="Clear search">×</button>}
              </label>
              {dataset.entities.some((entity) => entity.attributes.conference) && (
                <div className="filter-row">
                  <button className={conference === "All" ? "active" : ""} onClick={() => setConference("All")}>All options</button>
                  <select value={conference} onChange={(event) => setConference(event.target.value)} aria-label="Filter by conference">
                    <option>All</option>
                    {conferences.map((value) => <option key={value}>{value}</option>)}
                  </select>
                </div>
              )}
              {!!dataset.metricDefinitions?.length && <label className="candidate-sort"><span>Sort candidates</span><select value={candidateSort} onChange={(event) => setCandidateSort(event.target.value)}><option value="name">Name · A–Z</option>{dataset.metricDefinitions.map((metric) => <option key={metric.key} value={metric.key}>{metric.group ? `${metric.group} · ` : ""}{metric.label}</option>)}</select></label>}
            </div>
            <div className="candidate-list">
              {candidates.map((entity) => (
                <article className="candidate-card" key={entity.id}>
                  <TeamMark entity={entity} />
                  <div className="candidate-identity">
                    <strong>{entity.name}</strong>
                    {template.visibleAttributes.length > 0 && <span>{template.visibleAttributes.slice(0, 2).map((attribute) => formatAttribute(entity.attributes[attribute])).join(" · ")}</span>}
                    {entity.attributes.suggestion && <small>{formatAttribute(entity.attributes.suggestion)}</small>}
                  </div>
                  <div className="candidate-actions">
                    <button className="details" onClick={() => setDetailId(entity.id)} aria-label={`Open ${entity.name} details`} title={`Open ${entity.name} details`}>i</button>
                    {!!dataset.metricDefinitions?.length && <button className={compareIds.includes(entity.id) ? "compare active" : "compare"} onClick={() => toggleCompare(entity.id)} aria-label={`Compare ${entity.name}`} title={`Compare ${entity.name}`}>⇄</button>}
                    <button className="add-candidate" disabled={history.present.length >= template.maxLength} onClick={() => commit(insertEntity(history.present, entity.id, history.present.length, template.maxLength))} aria-label={`Add ${entity.name}`}>+</button>
                  </div>
                </article>
              ))}
              {!candidates.length && <div className="no-results"><strong>No match yet.</strong><span>Try a nickname, abbreviation, or broader filter.</span></div>}
            </div>
          </section>
        </div>
      </section>

      {detailEntity && <div className="modal-backdrop" role="presentation" onMouseDown={() => setDetailId(null)}><section className="entity-detail-modal" role="dialog" aria-modal="true" aria-labelledby="entity-detail-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setDetailId(null)} aria-label="Close details">×</button><div className="entity-detail-heading"><TeamMark entity={detailEntity} size="large" /><div><p className="kicker">ENTITY DEEP DIVE</p><h2 id="entity-detail-title">{detailEntity.name}</h2><span>{detailEntity.entityType}</span></div></div><div className="entity-detail-grid">{Object.entries(detailEntity.attributes).filter(([, value]) => value !== null && value !== "").map(([key, value]) => <div key={key}><span>{key.replace(/([a-z])([A-Z])/g, "$1 $2")}</span><strong>{formatAttribute(value)}</strong></div>)}</div><div className="entity-detail-actions"><button className="button button-secondary" onClick={() => { toggleCompare(detailEntity.id); setDetailId(null); }}>Add to comparison</button><button className="button button-primary" disabled={history.present.includes(detailEntity.id) || history.present.length >= template.maxLength} onClick={() => { commit(insertEntity(history.present, detailEntity.id, history.present.length, template.maxLength)); setDetailId(null); }}>Add to ranking</button></div></section></div>}

      {publishOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setPublishOpen(false)}>
          <section className="publish-modal" role="dialog" aria-modal="true" aria-labelledby="publish-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setPublishOpen(false)} aria-label="Close">×</button>
            <span className="success-mark">✓</span>
            <p className="kicker">BALLOT LOCKED</p>
            <h2 id="publish-title">Your receipts are ready.</h2>
            <p>This share preview preserves the order and the dataset version used for this draft.</p>
            <div className="publish-preview">
              {rankedEntities.slice(0, 5).map((entity, index) => <span key={entity.id}><b>{index + 1}</b>{entity.name}</span>)}
              <em>+ {Math.max(0, rankedEntities.length - 5)} more</em>
            </div>
            {authReady && isPermanentRankedUser(rankedUser) ? <div className="publish-actions">
              <button className="button button-primary" disabled={publishing} onClick={publishRanking}>{publishing ? "Publishing…" : "Publish relational ballot"}</button>
              <button className="button button-secondary" onClick={copyShareLink}>{copied ? "Copied!" : "Copy preview link"}</button>
            </div> : authReady ? <SignInGate nextPath={customConfig ? `/rank/custom/${customConfig.id}` : `/rank/${template.id}`} /> : <div className="sign-in-receipt"><strong>Checking your account…</strong></div>}
            {publishError && <p className="creator-error" role="alert">{publishError}</p>}
          </section>
        </div>
      )}
    </div>
  );
}
