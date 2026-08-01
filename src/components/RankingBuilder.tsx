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
import { SortableEntityCard } from "./SortableEntityCard";
import { TeamMark } from "./TeamMark";
import { encodeRanking, insertEntity, moveEntity, removeEntity, validateRanking } from "@/lib/domain/ranking";
import type { DatasetEnvelope, RankableEntity, RankingDraft, RankingTemplate } from "@/lib/domain/types";
import { entityMatches, formatAttribute, timeAgo } from "@/lib/utils";

type HistoryState = { past: string[][]; present: string[]; future: string[][] };

export function RankingBuilder({ template, initialDataset }: { template: RankingTemplate; initialDataset: DatasetEnvelope }) {
  const [dataset, setDataset] = useState(initialDataset);
  const [history, setHistory] = useState<HistoryState>({ past: [], present: [], future: [] });
  const [query, setQuery] = useState("");
  const [conference, setConference] = useState("All");
  const [saveState, setSaveState] = useState<"loading" | "saving" | "saved">("loading");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [publishOpen, setPublishOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const hydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storageKey = `ranked:draft:${template.id}`;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (template.entityType !== "team") return;
    const controller = new AbortController();
    fetch("/api/college-football/teams?year=2026", { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<DatasetEnvelope> : Promise.reject(new Error("Dataset failed")))
      .then(setDataset)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [template.entityType]);

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
      setSaveState("saved");
    }, 350);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [dataset.version, history.past.length, history.present, storageKey, template.id, template.version]);

  const entitiesById = useMemo(() => new Map(dataset.entities.map((entity) => [entity.id, entity])), [dataset.entities]);
  const rankedEntities = history.present.map((id) => entitiesById.get(id)).filter((entity): entity is RankableEntity => Boolean(entity));
  const rankedSet = new Set(history.present);
  const conferences = [...new Set(dataset.entities.map((entity) => String(entity.attributes.conference ?? "Other")))].sort();
  const candidates = dataset.entities.filter((entity) =>
    !rankedSet.has(entity.id) &&
    entityMatches(entity, query) &&
    (conference === "All" || entity.attributes.conference === conference),
  );
  const compareEntities = compareIds.map((id) => entitiesById.get(id)).filter((entity): entity is RankableEntity => Boolean(entity));
  const validationErrors = validateRanking(template, history.present);
  const remaining = Math.max(0, template.defaultLength - history.present.length);

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
    setCompareIds((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 3 ? [...current, id] : [...current.slice(1), id]);
  }

  const sharePath = `/ballot/preseason-2026?template=${template.id}&teams=${encodeRanking(history.present)}`;
  async function copyShareLink() {
    await navigator.clipboard.writeText(`${window.location.origin}${sharePath}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="builder-page">
      <section className="builder-heading shell">
        <div>
          <Link className="back-link" href="/">← Back to home</Link>
          <p className="kicker">{template.eyebrow}</p>
          <h1>{template.title}</h1>
          <p>{template.description}</p>
        </div>
        <div className="builder-meta">
          <span className={dataset.connected ? "data-badge is-live" : "data-badge"}>{dataset.connected ? "Live data" : "Demo data"}</span>
          <small>{dataset.sourceLabel} · updated {timeAgo(dataset.refreshedAt)}</small>
          {dataset.stale && <strong className="stale-warning">Live refresh failed; showing safe fallback.</strong>}
        </div>
      </section>

      <section className="builder-shell shell">
        <div className="builder-toolbar">
          <div className="draft-status"><span className={saveState === "saving" ? "saving-dot" : "saved-dot"} />{saveState === "loading" ? "Opening draft" : saveState === "saving" ? "Saving" : "Draft saved"}</div>
          <div className="toolbar-actions">
            <button onClick={undo} disabled={!history.past.length}>↶ Undo</button>
            <button onClick={redo} disabled={!history.future.length}>↷ Redo</button>
            <button className="publish-button" disabled={validationErrors.length > 0} onClick={() => setPublishOpen(true)}>{template.publishLabel}</button>
          </div>
        </div>

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
                    />
                  ))}
                  {Array.from({ length: Math.min(remaining, history.present.length ? 3 : 5) }, (_, index) => (
                    <div className="empty-rank" key={index}><span>{history.present.length + index + 1}</span><p>{history.present.length ? "Drop or add the next pick" : "Add a team from the candidate pool"}</p></div>
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
              {template.entityType === "team" && (
                <div className="filter-row">
                  <button className={conference === "All" ? "active" : ""} onClick={() => setConference("All")}>All teams</button>
                  <select value={conference} onChange={(event) => setConference(event.target.value)} aria-label="Filter by conference">
                    <option>All</option>
                    {conferences.map((value) => <option key={value}>{value}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="candidate-list">
              {candidates.map((entity) => (
                <article className="candidate-card" key={entity.id}>
                  <TeamMark entity={entity} />
                  <div className="candidate-identity">
                    <strong>{entity.name}</strong>
                    <span>{formatAttribute(entity.attributes[template.visibleAttributes[0]])} · {formatAttribute(entity.attributes[template.visibleAttributes[1]])}</span>
                    {entity.attributes.suggestion && <small>{formatAttribute(entity.attributes.suggestion)}</small>}
                  </div>
                  <div className="candidate-actions">
                    <button className={compareIds.includes(entity.id) ? "compare active" : "compare"} onClick={() => toggleCompare(entity.id)} aria-label={`Compare ${entity.name}`}>⇄</button>
                    <button className="add-candidate" disabled={history.present.length >= template.maxLength} onClick={() => commit(insertEntity(history.present, entity.id, history.present.length, template.maxLength))} aria-label={`Add ${entity.name}`}>+</button>
                  </div>
                </article>
              ))}
              {!candidates.length && <div className="no-results"><strong>No match yet.</strong><span>Try a nickname, abbreviation, or broader filter.</span></div>}
            </div>
          </section>
        </div>
      </section>

      {compareEntities.length > 0 && (
        <aside className="compare-drawer" aria-label="Entity comparison">
          <div className="compare-heading"><div><span>COMPARE</span><strong>{compareEntities.length} selected</strong></div><button onClick={() => setCompareIds([])}>Clear ×</button></div>
          <div className="compare-grid" style={{ gridTemplateColumns: `110px repeat(${compareEntities.length}, minmax(120px, 1fr))` }}>
            <span />
            {compareEntities.map((entity) => <strong key={entity.id}>{entity.name}</strong>)}
            {template.visibleAttributes.map((attribute) => (
              <div className="compare-row" key={attribute}>
                <span>{attribute.replace(/([A-Z])/g, " $1")}</span>
                {compareEntities.map((entity) => <span key={entity.id}>{formatAttribute(entity.attributes[attribute])}</span>)}
              </div>
            ))}
          </div>
        </aside>
      )}

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
            <div className="publish-actions">
              <Link className="button button-primary" href={sharePath}>Open public ballot</Link>
              <button className="button button-secondary" onClick={copyShareLink}>{copied ? "Copied!" : "Copy share link"}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
