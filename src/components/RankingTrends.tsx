"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SignInGate } from "./SignInGate";
import { TeamMark } from "./TeamMark";
import type { RankableEntity } from "@/lib/domain/types";
import { entityRankSeries, loadCommunityRankingTrends, loadMyRankingTrends, trendEntities, type RankingTrendList, type TrendEntity } from "@/lib/supabase/rankingTrends";

const SERIES_COLORS = ["#17694a", "#c07b16", "#4169a8", "#b54c43", "#7651a8", "#17848b", "#9a5c79", "#647331", "#353f49"];
type TrendPerspective = "mine" | "community";

function PerspectiveToggle({ value, onChange }: { value: TrendPerspective; onChange: (value: TrendPerspective) => void }) {
  return <div className="trend-perspective-toggle" role="tablist" aria-label="Ranking perspective"><button type="button" role="tab" aria-selected={value === "mine"} className={value === "mine" ? "is-active" : ""} onClick={() => onChange("mine")}>My Rankings</button><button type="button" role="tab" aria-selected={value === "community"} className={value === "community" ? "is-active" : ""} onClick={() => onChange("community")}>All Voters</button></div>;
}

function markEntity(entity: TrendEntity, entityType: string): RankableEntity {
  return {
    id: entity.canonicalKey,
    entityType,
    name: entity.name,
    imageUrl: entity.imageUrl ?? undefined,
    color: entity.color ?? undefined,
    attributes: {},
  };
}

function shortPeriod(title: string): string {
  return title.replace(/^Week of /, "").replace(/ season$/i, "");
}

function yTicks(maxRank: number): number[] {
  const step = maxRank <= 10 ? 2 : maxRank <= 30 ? 5 : 10;
  const ticks = [1];
  for (let rank = step; rank <= maxRank; rank += step) if (!ticks.includes(rank)) ticks.push(rank);
  if (!ticks.includes(maxRank)) ticks.push(maxRank);
  return ticks;
}

function RankTrendChart({ list, selectedIds, entitiesById }: { list: RankingTrendList; selectedIds: string[]; entitiesById: Map<string, TrendEntity> }) {
  const width = 920;
  const height = 410;
  const margin = { top: 24, right: 24, bottom: 72, left: 52 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const x = (index: number) => list.snapshots.length <= 1 ? margin.left + plotWidth / 2 : margin.left + (index / (list.snapshots.length - 1)) * plotWidth;
  const y = (rank: number) => margin.top + ((rank - 1) / Math.max(1, list.maxLength - 1)) * plotHeight;
  const labelEvery = Math.max(1, Math.ceil(list.snapshots.length / 8));

  return <div className="trend-chart-wrap">
    <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Rank over time for ${selectedIds.map((id) => entitiesById.get(id)?.name).filter(Boolean).join(", ")}`}>
      <rect x={margin.left} y={margin.top} width={plotWidth} height={plotHeight} rx="10" className="trend-plot-bg" />
      {yTicks(list.maxLength).map((rank) => <g key={rank}>
        <line x1={margin.left} x2={width - margin.right} y1={y(rank)} y2={y(rank)} className="trend-grid-line" />
        <text x={margin.left - 12} y={y(rank) + 4} textAnchor="end" className="trend-y-label">#{rank}</text>
      </g>)}
      {list.snapshots.map((snapshot, index) => index % labelEvery === 0 || index === list.snapshots.length - 1 ? <g key={snapshot.rankingId}>
        <line x1={x(index)} x2={x(index)} y1={margin.top} y2={height - margin.bottom} className="trend-period-line" />
        <text x={x(index)} y={height - 42} textAnchor="middle" className="trend-x-label">{shortPeriod(snapshot.periodTitle)}</text>
      </g> : null)}
      {selectedIds.map((entityId, seriesIndex) => {
        const entity = entitiesById.get(entityId);
        const series = entityRankSeries(list, entityId);
        const color = SERIES_COLORS[seriesIndex % SERIES_COLORS.length];
        let path = "";
        let hasPrevious = false;
        series.forEach((rank, index) => {
          if (rank == null) {
            hasPrevious = false;
            return;
          }
          path += `${hasPrevious ? " L" : " M"} ${x(index)} ${y(rank)}`;
          hasPrevious = true;
        });
        return <g key={entityId}>
          <path d={path.trim()} fill="none" stroke={color} className="trend-series-line" />
          {series.map((rank, index) => rank == null ? null : <circle key={`${entityId}-${list.snapshots[index].rankingId}`} cx={x(index)} cy={y(rank)} r="5" fill={color} className="trend-series-point"><title>{entity?.name}: #{rank} · {list.snapshots[index].periodTitle}</title></circle>)}
        </g>;
      })}
    </svg>
    {!selectedIds.length ? <div className="trend-chart-empty"><strong>Select an option.</strong><span>Its rank history will appear here.</span></div> : null}
  </div>;
}

export function RankingTrends() {
  const [lists, setLists] = useState<RankingTrendList[]>([]);
  const [selectedListId, setSelectedListId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [perspective, setPerspective] = useState<TrendPerspective>("mine");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [state, setState] = useState<"loading" | "ready" | "signed-out" | "empty">("loading");

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => { if (active) setState("loading"); });
    const loader = perspective === "mine" ? loadMyRankingTrends : loadCommunityRankingTrends;
    void loader()
      .then((items) => {
        if (!active) return;
        setLists(items);
        setSelectedListId(items[0]?.templateVersionId ?? "");
        setSelectedIds(items[0]?.snapshots.at(-1)?.placements.slice(0, 3).map((placement) => placement.entityId) ?? []);
        setState(items.length ? "ready" : "empty");
      })
      .catch(() => { if (active) setState(perspective === "mine" ? "signed-out" : "empty"); });
    return () => { active = false; };
  }, [perspective]);

  const list = useMemo(() => lists.find((item) => item.templateVersionId === selectedListId) ?? lists[0], [lists, selectedListId]);
  const entities = useMemo(() => list ? trendEntities(list) : [], [list]);
  const entitiesById = useMemo(() => new Map(entities.map((entity) => [entity.entityId, entity])), [entities]);
  const matches = useMemo(() => entities.filter((entity) => entity.name.toLowerCase().includes(deferredQuery)), [deferredQuery, entities]);

  function toggleEntity(entityId: string) {
    setSelectedIds((current) => current.includes(entityId) ? current.filter((id) => id !== entityId) : [...current, entityId]);
  }

  function selectLatest(count: number) {
    setSelectedIds(list?.snapshots.at(-1)?.placements.slice(0, count).map((placement) => placement.entityId) ?? []);
  }

  function chooseList(templateVersionId: string) {
    const next = lists.find((item) => item.templateVersionId === templateVersionId);
    setSelectedListId(templateVersionId);
    setSelectedIds(next?.snapshots.at(-1)?.placements.slice(0, 3).map((placement) => placement.entityId) ?? []);
    setQuery("");
  }

  if (state === "loading") return <main className="trends-page shell"><PerspectiveToggle value={perspective} onChange={setPerspective} /><div className="trends-empty"><strong>Loading {perspective === "mine" ? "your" : "community"} ranking history…</strong></div></main>;
  if (state === "signed-out") return <main className="trends-page shell"><PerspectiveToggle value={perspective} onChange={setPerspective} /><section className="trends-heading"><div><p className="kicker">OPINION TRENDS</p><h1>See every move.</h1><p>Sign in for your history, or choose All Voters.</p></div></section><SignInGate /></main>;
  if (state === "empty" || !list) return <main className="trends-page shell"><PerspectiveToggle value={perspective} onChange={setPerspective} /><section className="trends-heading"><div><p className="kicker">OPINION TRENDS</p><h1>{perspective === "mine" ? "Your first line starts here." : "Community history starts with a vote."}</h1><p>{perspective === "mine" ? "Publish a period-based ranking to begin your history." : "No public period-based rankings are available yet."}</p><Link className="button button-primary" href="/consensus">Find a poll</Link></div></section></main>;

  return <main className="trends-page shell">
    <section className="trends-heading">
      <div><p className="kicker">OPINION TRENDS</p><h1>See every move.</h1><p>Choose a list. Compare any options.</p></div>
      <div className="trend-heading-controls"><PerspectiveToggle value={perspective} onChange={setPerspective} /><label><span>Ranking list</span><select value={list.templateVersionId} onChange={(event) => chooseList(event.target.value)}>{lists.map((item) => <option key={item.templateVersionId} value={item.templateVersionId}>{item.title}</option>)}</select></label></div>
    </section>

    <section className="trend-workspace">
      <header className="trend-workspace-header">
        <div><span>{perspective === "mine" ? "MY " : "ALL VOTERS · "}{list.responseCadence === "weekly" ? "WEEKLY HISTORY" : list.responseCadence === "seasonal" ? "SEASON HISTORY" : "RANKING HISTORY"}</span><h2>{list.title}</h2></div>
        <div><strong>{list.snapshots.length}</strong><span>{list.snapshots.length === 1 ? "period" : "periods"}</span></div>
      </header>
      <div className="trend-layout">
        <div className="trend-visual">
          <div className="trend-legend">{selectedIds.map((entityId, index) => {
            const entity = entitiesById.get(entityId);
            if (!entity) return null;
            return <button key={entityId} type="button" onClick={() => toggleEntity(entityId)} style={{ "--series-color": SERIES_COLORS[index % SERIES_COLORS.length] } as React.CSSProperties}><TeamMark entity={markEntity(entity, list.entityType)} size="small" /><span>{entity.name}</span><b>×</b></button>;
          })}</div>
          <RankTrendChart list={list} selectedIds={selectedIds} entitiesById={entitiesById} />
          {list.snapshots.length === 1 ? <p className="trend-next-period">Your next {list.responseCadence === "weekly" ? "weekly " : ""}submission adds the next point.</p> : null}
        </div>

        <aside className="trend-picker">
          <div><span>COMPARE OPTIONS</span><strong>{selectedIds.length} selected</strong></div>
          <label className="trend-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${list.entityType}s`} /></label>
          <div className="trend-quick-actions"><button type="button" onClick={() => selectLatest(3)}>Latest top 3</button><button type="button" onClick={() => selectLatest(5)}>Latest top 5</button><button type="button" onClick={() => setSelectedIds([])}>Clear</button></div>
          <div className="trend-entity-list">{matches.map((entity) => <button key={entity.entityId} type="button" className={selectedIds.includes(entity.entityId) ? "is-selected" : ""} aria-pressed={selectedIds.includes(entity.entityId)} onClick={() => toggleEntity(entity.entityId)}><TeamMark entity={markEntity(entity, list.entityType)} size="small" /><span>{entity.name}</span><b>{selectedIds.includes(entity.entityId) ? "✓" : "+"}</b></button>)}</div>
        </aside>
      </div>

      {selectedIds.length ? <div className="trend-table-wrap"><table className="trend-table"><thead><tr><th>Period</th>{selectedIds.map((id) => <th key={id}>{entitiesById.get(id)?.name}</th>)}</tr></thead><tbody>{list.snapshots.map((snapshot) => <tr key={snapshot.rankingId}><th>{snapshot.periodTitle}</th>{selectedIds.map((entityId) => <td key={entityId}>{snapshot.placements.find((placement) => placement.entityId === entityId)?.position ? `#${snapshot.placements.find((placement) => placement.entityId === entityId)?.position}` : "—"}</td>)}</tr>)}</tbody></table></div> : null}
    </section>
  </main>;
}
