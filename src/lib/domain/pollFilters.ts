import type { CatalogFilterDefinition, RankableEntity, RankingSubject } from "./types";
import { rankableCategory } from "./rankableCatalog";

const FILTER_LABELS: Record<string, string> = { conference: "Conference", team: "Team", position: "Position", classYear: "Class", week: "Week", completed: "Game status", conferenceGame: "Conference game", state: "State", dome: "Dome", grass: "Grass field", committedTo: "Committed to", stars: "Stars", origin: "From", destination: "To", side: "Unit", collegeConference: "College conference", collegeTeam: "College", round: "Draft round" };

function filterValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

export function discoverCatalogFilters(subject: RankingSubject, entities: RankableEntity[]): CatalogFilterDefinition[] {
  return rankableCategory(subject).filterKeys.flatMap((key) => {
    const values = [...new Set(entities.map((entity) => filterValue(entity.attributes[key])).filter(Boolean))].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
    return values.length ? [{ key, label: FILTER_LABELS[key] ?? key, values }] : [];
  });
}

export function mergeCatalogFilters(current: CatalogFilterDefinition[], incoming: CatalogFilterDefinition[]): CatalogFilterDefinition[] {
  const merged = new Map(current.map((filter) => [filter.key, filter]));
  for (const filter of incoming) {
    const previous = merged.get(filter.key);
    merged.set(filter.key, {
      ...previous,
      ...filter,
      values: [...new Set([...(previous?.values ?? []), ...filter.values])].sort((left, right) => left.localeCompare(right, undefined, { numeric: true })),
    });
  }
  return [...merged.values()];
}
