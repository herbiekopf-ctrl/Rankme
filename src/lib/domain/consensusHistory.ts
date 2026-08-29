export type ConsensusHistoryPosition = {
  entityId: string;
  name: string;
  imageUrl: string | null;
  color: string | null;
  position: number;
};

export type ConsensusHistoryPeriodInput = {
  positions: ConsensusHistoryPosition[];
};

export type ConsensusHistoryPoint = {
  periodIndex: number;
  position: number;
};

export type ConsensusHistorySeries = {
  entityId: string;
  name: string;
  imageUrl: string | null;
  color: string | null;
  points: ConsensusHistoryPoint[];
};

export function buildConsensusHistorySeries(periods: ConsensusHistoryPeriodInput[]): ConsensusHistorySeries[] {
  const byEntityId = new Map<string, ConsensusHistorySeries>();
  periods.forEach((period, periodIndex) => {
    for (const position of period.positions) {
      const existing = byEntityId.get(position.entityId);
      if (existing) {
        existing.name = position.name;
        existing.imageUrl = position.imageUrl;
        existing.color = position.color;
        existing.points.push({ periodIndex, position: position.position });
      } else {
        byEntityId.set(position.entityId, {
          entityId: position.entityId,
          name: position.name,
          imageUrl: position.imageUrl,
          color: position.color,
          points: [{ periodIndex, position: position.position }],
        });
      }
    }
  });
  const currentPeriodIndex = periods.length - 1;
  return [...byEntityId.values()].sort((left, right) => {
    const leftCurrent = left.points.find((point) => point.periodIndex === currentPeriodIndex)?.position ?? Number.POSITIVE_INFINITY;
    const rightCurrent = right.points.find((point) => point.periodIndex === currentPeriodIndex)?.position ?? Number.POSITIVE_INFINITY;
    return leftCurrent - rightCurrent || left.name.localeCompare(right.name);
  });
}

export function consensusMovementLabel(series: ConsensusHistorySeries, currentPeriodIndex: number): string {
  const current = series.points.find((point) => point.periodIndex === currentPeriodIndex);
  if (!current) return `Exited after reaching #${series.points.at(-1)?.position ?? "—"}`;
  const earlier = series.points.filter((point) => point.periodIndex < currentPeriodIndex).at(-1);
  if (!earlier) return `Entered at #${current.position}`;
  const movement = earlier.position - current.position;
  if (movement > 0) return `Rose ${movement} to #${current.position}`;
  if (movement < 0) return `Fell ${Math.abs(movement)} to #${current.position}`;
  return `Held at #${current.position}`;
}
