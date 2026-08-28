export type AvailableConsensusFilter = {
  id: string;
  key: string;
  value: string;
};

export function buildUnlockedConsensusFilters(
  requestedIds: string[],
  availableFilters: AvailableConsensusFilter[],
): Record<string, string> | null {
  const availableById = new Map(availableFilters.map((filter) => [filter.id, filter]));
  const result: Record<string, string> = {};

  for (const id of [...new Set(requestedIds)]) {
    const filter = availableById.get(id);
    if (!filter) return null;
    const existing = result[filter.key];
    if (existing && existing !== filter.value) return null;
    result[filter.key] = filter.value;
  }

  return result;
}
