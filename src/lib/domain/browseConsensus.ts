export type ConsensusFilterSelection = {
  categoryId: string;
  optionId: string;
};

export type UnlockedConsensusCategory = {
  id: string;
  key: string;
  options: Array<{ id: string; value: string }>;
};

export function buildUnlockedConsensusFilters(
  requested: ConsensusFilterSelection[],
  unlockedCategories: UnlockedConsensusCategory[],
): Record<string, string> | null {
  const categoryById = new Map(unlockedCategories.map((category) => [category.id, category]));
  const selectedCategories = new Set<string>();
  const result: Record<string, string> = {};

  for (const selection of requested) {
    if (selectedCategories.has(selection.categoryId)) return null;
    selectedCategories.add(selection.categoryId);
    const category = categoryById.get(selection.categoryId);
    const option = category?.options.find((candidate) => candidate.id === selection.optionId);
    if (!category || !option || result[category.key]) return null;
    result[category.key] = option.value;
  }

  return result;
}
