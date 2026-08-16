export type OwnedConsensusFilter = {
  id: string;
  key: string;
  value: string;
};

export function buildOwnedConsensusFilters(
  requestedIds: string[],
  ownedFilters: OwnedConsensusFilter[],
): Record<string, string> | null {
  const ownedById = new Map(ownedFilters.map((filter) => [filter.id, filter]));
  const result: Record<string, string> = {};

  for (const id of [...new Set(requestedIds)]) {
    const filter = ownedById.get(id);
    if (!filter) return null;
    const existing = result[filter.key];
    if (existing && existing !== filter.value) return null;
    result[filter.key] = filter.value;
  }

  return result;
}
