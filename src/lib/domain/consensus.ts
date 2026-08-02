export type AggregatePosition = {
  entityId: string;
  points: number;
  firstPlaceVotes: number;
  ballots: number;
};

export function aggregateBallots(ballots: string[][], listLength: number): AggregatePosition[] {
  const aggregate = new Map<string, AggregatePosition>();

  for (const ballot of ballots) {
    for (const [index, entityId] of ballot.slice(0, listLength).entries()) {
      const current = aggregate.get(entityId) ?? {
        entityId,
        points: 0,
        firstPlaceVotes: 0,
        ballots: 0,
      };
      current.points += listLength - index;
      current.firstPlaceVotes += index === 0 ? 1 : 0;
      current.ballots += 1;
      aggregate.set(entityId, current);
    }
  }

  return [...aggregate.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.firstPlaceVotes - a.firstPlaceVotes ||
      b.ballots - a.ballots ||
      a.entityId.localeCompare(b.entityId),
  );
}

export function isCohortSuppressed(sampleSize: number, threshold = 25): boolean {
  return sampleSize < threshold;
}
