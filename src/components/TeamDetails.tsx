"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { TeamMark } from "./TeamMark";
import { collegeFootballSeason } from "@/lib/domain/rankingPeriods";
import type { DatasetEnvelope, EntityAnalyticsSnapshot, EntityGameSnapshot, RankableEntity } from "@/lib/domain/types";

type Props = { team: RankableEntity; season?: number };

export function TeamDetailsButton({ team, season }: Props) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="team-details-trigger" aria-haspopup="dialog" aria-label={`View ${team.name} team details`} onClick={() => setOpen(true)}>{team.name}</button>
    {open && <TeamDetailsDialog team={team} season={season} close={() => setOpen(false)} />}
  </>;
}

function gameDate(game: EntityGameSnapshot) {
  if (!game.date || !Number.isFinite(Date.parse(game.date))) return game.week == null ? "TBD" : `Wk ${game.week}`;
  return new Date(game.date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
}

export function TeamDetailsDialog({ team, season = collegeFootballSeason(), close, children }: Props & { close: () => void; children?: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [resolved, setResolved] = useState(team);
  const [data, setData] = useState<EntityAnalyticsSnapshot | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    async function load() {
      let entity = team;
      if (!entity.relationalId || !Object.keys(entity.attributes).length) {
        const response = await fetch(`/api/college-football/teams?year=${season}`, { signal: abort.signal });
        if (!response.ok) throw new Error();
        const catalog: DatasetEnvelope = await response.json();
        const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
        const matches = catalog.entities.filter(item => [item.name, ...(item.aliases ?? [])].some(name => normalize(name) === normalize(team.name)));
        entity = catalog.entities.find(item => item.relationalId === team.id || item.id === team.id)
          ?? (matches.length === 1 ? matches[0] : team);
      }
      if (!abort.signal.aborted) setResolved(entity);
      if (!entity.relationalId) throw new Error();
      const response = await fetch(`/api/college-football/entity-analytics?entityId=${encodeURIComponent(entity.relationalId)}&season=${season}`, { signal: abort.signal });
      if (!response.ok) throw new Error();
      const snapshot: EntityAnalyticsSnapshot = await response.json();
      if (!abort.signal.aborted) setData(snapshot);
    }
    load().catch(() => { if (!abort.signal.aborted) setError(true); });
    return () => abort.abort();
  }, [team, season, attempt]);
  const metrics = [["AP rank", "apRank"], ["FPI", "fpi"], ["SP+", "spOverall"], ["Elo", "elo"], ["Talent", "talent"], ["Strength of schedule", "sos"]].filter(([, key]) => resolved.attributes[key] != null);
  const strongestLoss = data?.games.filter(game => game.result === "L" && game.difficultyScore != null)
    .sort((a, b) => b.difficultyScore! - a.difficultyScore!)[0];
  return createPortal(<dialog ref={dialog} className="team-gamecard" aria-label={`${team.name} team details`} onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <div className="gamecard-body">
      <header><TeamMark entity={resolved} size="large" /><div><small>{season} season</small><h2>{resolved.name}</h2><p>{[resolved.attributes.conference, resolved.attributes.record].filter(Boolean).join(" · ")}</p></div><button type="button" autoFocus onClick={close} aria-label="Close team details">×</button></header>
      {data ? <>
        <div className="gamecard-highlights">{([["Best win", data.bestWin, "W"], ["Worst loss", data.worstLoss, "L"]] as const).map(([label, game, result]) => <section key={label}><small>{label}</small><strong>{game?.opponent ?? (data.games.some(g => g.result === result || (g.completed && !g.result)) ? "Unavailable" : result === "W" ? "No recorded wins" : "No recorded losses")}</strong>{game && <span>{game.result} {game.scoreLabel} · {gameDate(game)}</span>}</section>)}</div>
        <h3>Schedule & results</h3>
        {data.games.length ? <ol className="gamecard-schedule">{data.games.map(game => <li key={game.id}><time>{gameDate(game)}</time><div><strong>{game.location === "away" ? "at " : game.location === "neutral" ? "vs (N) " : "vs "}{game.opponent}</strong>{!game.completed && game.matchupLabel && <small>{game.matchupLabel}</small>}</div><b data-result={game.result}>{game.result ? `${game.result} ${game.scoreLabel}` : game.completed ? "Final · score unavailable" : "Upcoming"}</b></li>)}</ol> : <p>No schedule available for this season.</p>}
      </> : error ? <p role="status">Schedule unavailable. <button onClick={() => { setError(false); setAttempt(n => n + 1); }}>Try again</button></p> : <p role="status">Loading schedule and results…</p>}
      {strongestLoss && <details className="gamecard-stats"><summary>Best loss by opponent strength</summary><p>{strongestLoss.opponent} · L {strongestLoss.scoreLabel} · {gameDate(strongestLoss)}</p></details>}
      {!children && metrics.length > 0 && <details className="gamecard-stats"><summary>Team ratings</summary><dl>{metrics.map(([label, key]) => <div key={key}><dt>{label}</dt><dd>{resolved.attributes[key]}</dd></div>)}</dl></details>}
      {children}
    </div>
  </dialog>, document.body);
}
