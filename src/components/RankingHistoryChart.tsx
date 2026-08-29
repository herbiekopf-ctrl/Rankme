"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { TeamMark } from "./TeamMark";
import { buildConsensusHistorySeries, consensusMovementLabel } from "@/lib/domain/consensusHistory";
import { displayRankingPeriod, type BrowseConsensusPeriod } from "@/lib/supabase/browsePolls";
import type { RankableEntity } from "@/lib/domain/types";

const ROW_HEIGHT = 34;

function historyEntity(entity: { entityId: string; name: string; imageUrl: string | null; color: string | null }): RankableEntity {
  return { id: entity.entityId, entityType: "team", name: entity.name, imageUrl: entity.imageUrl ?? undefined, color: entity.color ?? undefined, attributes: {} };
}

function periodX(periodIndex: number, periodCount: number): number {
  if (periodCount <= 1) return 50;
  return 8 + (periodIndex * 84) / (periodCount - 1);
}

function rankY(position: number): number {
  return (position - 0.5) * ROW_HEIGHT;
}

export function RankingHistoryChart({ periods }: { periods: BrowseConsensusPeriod[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const usablePeriods = useMemo(() => periods.filter((period) => !period.suppressed && period.positions.length), [periods]);
  const series = useMemo(() => buildConsensusHistorySeries(usablePeriods), [usablePeriods]);
  const rowCount = Math.max(25, ...usablePeriods.flatMap((period) => period.positions.map((position) => position.position)), 1);
  const chartHeight = rowCount * ROW_HEIGHT;
  const selected = selectedId ? series.find((team) => team.entityId === selectedId) ?? null : null;
  const currentPeriodIndex = usablePeriods.length - 1;

  if (usablePeriods.length < 2) {
    return <div className="ranking-history-empty"><strong>More weekly rankings are needed.</strong><span>Movement appears after at least two weeks have published ballots.</span></div>;
  }

  return <section className="ranking-history" aria-label="Top 25 movement over the last three weeks">
    <div className="ranking-history-intro">
      <div><p className="kicker">LAST {usablePeriods.length} WEEKS</p><h3>How the Top 25 moved</h3><p>Tap any logo to trace that team. The current week is highlighted.</p></div>
      {selected ? <button type="button" className="ranking-history-selection" onClick={() => setSelectedId(null)}><TeamMark entity={historyEntity(selected)} size="small" /><span><strong>{selected.name}</strong><small>{consensusMovementLabel(selected, currentPeriodIndex)} · Clear</small></span></button> : null}
    </div>
    <div className="ranking-history-scroll">
      <div className="ranking-history-canvas" style={{ "--history-height": `${chartHeight}px` } as CSSProperties}>
        <div className="ranking-history-headings">
          {usablePeriods.map((period, index) => <div key={period.cycleId} className={index === currentPeriodIndex ? "is-current" : ""}><span>{index === currentPeriodIndex ? "CURRENT WEEK" : period.week ? `WEEK ${period.week}` : `PRIOR WEEK ${usablePeriods.length - index - 1}`}</span><strong>{displayRankingPeriod(period.title)}</strong><small>{period.selectedResponseCount ?? period.responseCount} ballots</small></div>)}
        </div>
        <div className="ranking-history-plot" style={{ height: chartHeight }}>
          <svg viewBox={`0 0 100 ${chartHeight}`} preserveAspectRatio="none" aria-hidden="true">
            {series.flatMap((team) => team.points.slice(0, -1).flatMap((point, pointIndex) => {
              const next = team.points[pointIndex + 1];
              if (!next || next.periodIndex !== point.periodIndex + 1) return [];
              const x1 = periodX(point.periodIndex, usablePeriods.length);
              const x2 = periodX(next.periodIndex, usablePeriods.length);
              const y1 = rankY(point.position);
              const y2 = rankY(next.position);
              return <path
                key={`${team.entityId}:${point.periodIndex}`}
                className={selectedId ? selectedId === team.entityId ? "is-selected" : "is-muted" : ""}
                d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`}
                style={{ "--team-line": team.color ?? "#6c8276" } as CSSProperties}
              />;
            }))}
          </svg>
          {usablePeriods.flatMap((period, periodIndex) => period.positions.map((position) => {
            const isCurrent = periodIndex === currentPeriodIndex;
            const isSelected = selectedId === position.entityId;
            return <button
              type="button"
              key={`${period.cycleId}:${position.entityId}`}
              className={`ranking-history-node${isCurrent ? " is-current" : ""}${isSelected ? " is-selected" : ""}${selectedId && !isSelected ? " is-muted" : ""}`}
              style={{ left: `${periodX(periodIndex, usablePeriods.length)}%`, top: rankY(position.position) } as CSSProperties}
              onClick={() => setSelectedId((current) => current === position.entityId ? null : position.entityId)}
              aria-label={`${position.name}, rank ${position.position}, ${displayRankingPeriod(period.title)}`}
            ><span>#{position.position}</span><TeamMark entity={historyEntity(position)} size="small" /></button>;
          }))}
        </div>
      </div>
    </div>
  </section>;
}
