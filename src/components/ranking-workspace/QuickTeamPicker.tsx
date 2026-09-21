"use client";
import { useEffect, useMemo, useState } from "react";
import { TeamMark } from "../TeamMark";
import { entityMatches } from "@/lib/utils";
import type { RankingWorkspaceController } from "@/hooks/useRankingWorkspace";
import type { ApPoll } from "@/lib/adapters/apPoll";
export function QuickTeamPicker({ controller }: { controller: RankingWorkspaceController }) {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const optionLabel = controller.template.entityType === "team" ? "team" : controller.template.entityType === "stadium" ? "stadium" : "option";
  const [apPoll, setApPoll] = useState<ApPoll | null>(null);
  const isTop25 = controller.template.id === "top-25";
  useEffect(() => {
    if (!isTop25) return;
    const abort = new AbortController();
    fetch("/api/ap-poll", { signal: abort.signal }).then(r => r.ok ? r.json() : null).then(result => { if (!abort.signal.aborted) setApPoll(result); }).catch(() => undefined);
    return () => abort.abort();
  }, [isTop25]);
  const starter = useMemo(() => {
    if (!apPoll || apPoll.season !== controller.periodContext.season) return [];
    const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const ids = apPoll.teams.filter(team => team.rank <= 25).map(team => {
      const matches = controller.dataset.entities.filter(entity => [entity.name, ...(entity.aliases ?? [])].some(name => normalize(name) === normalize(team.name)));
      return matches.length === 1 ? matches[0].id : null;
    });
    return ids.length === 25 && ids.every((id): id is string => Boolean(id)) && new Set(ids).size === 25 ? ids : [];
  }, [apPoll, controller.dataset.entities, controller.periodContext.season]);
  const results = useMemo(() => controller.dataset.entities.filter(e => entityMatches({ ...e, attributes: {} }, query))
    .sort((a, b) => (Number(a.attributes.apRank) || 999) - (Number(b.attributes.apRank) || 999) || a.name.localeCompare(b.name))
    .filter(e => query || !controller.history.present.includes(e.id)).slice(0, query ? 15 : 3), [controller.dataset.entities, controller.history.present, query]);
  return <div className="quick-team-picker">
    {!controller.history.present.length && starter.length ? <div className="ballot-quick-start"><button disabled={controller.isPeriodLocked} onClick={() => { controller.commit(starter); setMessage("AP order copied into your draft. Make it yours, then submit."); }}>Start with the AP Top 25</button><small>{apPoll?.week} · {apPoll?.releasedAt.slice(0, 10)} · Nothing submitted yet</small></div> : null}
    <label htmlFor="quick-team-search">{controller.remaining ? `Add your #${controller.history.present.length + 1} pick` : "Ballot full · Remove a pick to add another"}</label>
    <input id="quick-team-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={`Find a ${optionLabel}…`} />
    {(!controller.history.present.length || query) ? <ul>{results.map(team => {
      const rank = controller.history.present.indexOf(team.id) + 1;
      return <li key={team.id}><TeamMark entity={team} size="small" /><button className="quick-team-name" onClick={() => controller.setDetailId(team.id)}>{team.name}</button><button disabled={controller.isPeriodLocked || Boolean(rank) || !controller.remaining} onClick={() => { controller.addEntity(team.id); setMessage(`${team.name} added at #${controller.history.present.length + 1}`); setQuery(""); }}>{rank ? `#${rank} ✓` : "+ Add"}</button></li>;
    })}</ul> : null}
    {query && !results.length ? <p>No teams match. Try another name.</p> : null}
    <span className="quick-picker-status" role="status">{message}</span>
  </div>;
}
