import "server-only";

import { teamsDataset, type CollegeFootballSnapshot } from "@/lib/adapters/cfbd";
import { getCollegeFootballSnapshot } from "@/lib/data/collegeFootballSnapshot";
import { RANKABLE_CATEGORIES, rankableCategory } from "@/lib/domain/rankableCatalog";
import { seedStadiumDataset, seedTeamDataset } from "@/lib/domain/seed";
import type { CatalogFilterDefinition, DatasetEnvelope, PollCatalog, RankableEntity, RankingSubject } from "@/lib/domain/types";
import { loadSupabaseCatalogReceipt, loadSupabaseRankableDataset } from "@/lib/data/supabaseRankables";

const FILTER_LABELS: Record<string, string> = {
  conference: "Conference",
  team: "Team",
  position: "Position",
  classYear: "Class",
  week: "Week",
  completed: "Game status",
  conferenceGame: "Conference game",
  state: "State",
  dome: "Dome",
  grass: "Grass field",
  committedTo: "Committed to",
  stars: "Stars",
  origin: "From",
  destination: "To",
  side: "Unit",
  collegeConference: "College conference",
  collegeTeam: "College",
  round: "Draft round",
};

function inferredMetrics(entities: DatasetEnvelope["entities"]): NonNullable<DatasetEnvelope["metricDefinitions"]> {
  const keys = new Set<string>();
  for (const entity of entities) for (const [key, value] of Object.entries(entity.attributes)) if (typeof value === "number") keys.add(key);
  return [...keys].map((key) => {
    const values = entities.map((entity) => entity.attributes[key]).filter((value): value is number => typeof value === "number");
    const integer = values.every(Number.isInteger);
    const lower = key.toLowerCase();
    return {
      key,
      label: key.replaceAll(":", " · ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (letter) => letter.toUpperCase()),
      description: `Compare every eligible option by ${key.replaceAll(":", " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()}.`,
      format: integer ? "integer" as const : "decimal" as const,
      direction: lower.includes("allowed") || lower.includes("loss") || lower.includes("rank") || lower.includes("round") ? "asc" as const : "desc" as const,
      group: "Other" as const,
      source: "Saved dataset",
    };
  });
}

function envelope(
  result: Awaited<ReturnType<typeof getCollegeFootballSnapshot>>,
  subject: RankingSubject,
  entities: DatasetEnvelope["entities"],
): DatasetEnvelope {
  const category = rankableCategory(subject);
  return {
    id: `${result.snapshot.id}-${subject}`,
    version: result.snapshot.version,
    source: "collegefootballdata",
    sourceLabel: result.snapshot.sourceLabel,
    refreshedAt: result.snapshot.refreshedAt,
    stale: result.stale,
    connected: true,
    credentialConfigured: true,
    refreshMode: result.refreshMode,
    upstreamRequests: result.snapshot.upstreamRequests,
    warnings: result.snapshot.warnings,
    metricDefinitions: result.snapshot.metricsByEntityType[category.entityType] ?? inferredMetrics(entities),
    entities,
  };
}

export function entitiesForSubject(snapshot: CollegeFootballSnapshot, subject: RankingSubject): RankableEntity[] {
  switch (subject) {
    case "teams": return snapshot.teams;
    case "players": return snapshot.players;
    case "coaches": return snapshot.coaches;
    case "conferences": return snapshot.conferences;
    case "games": return snapshot.games;
    case "stadiums": return snapshot.stadiums;
    case "towns": return snapshot.towns;
    case "mascots": return snapshot.mascots;
    case "recruiting-classes": return snapshot.recruitingClasses;
    case "recruits": return snapshot.recruits;
    case "transfers": return snapshot.transfers;
    case "units": return snapshot.units;
    case "team-seasons": return snapshot.teamSeasons;
    case "draft-picks": return snapshot.draftPicks;
  }
}

function normalizedFilterValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value ?? "").trim();
}

function matchesFilters(entity: RankableEntity, filters: Record<string, string>): boolean {
  return Object.entries(filters).every(([key, selected]) => {
    if (!selected || selected === "All") return true;
    return normalizedFilterValue(entity.attributes[key]).toLocaleLowerCase() === selected.toLocaleLowerCase();
  });
}

function filterDefinitions(subject: RankingSubject, entities: RankableEntity[]): CatalogFilterDefinition[] {
  return rankableCategory(subject).filterKeys.flatMap((key) => {
    const values = [...new Set(entities.map((entity) => normalizedFilterValue(entity.attributes[key])).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (values.length < 2) return [];
    return [{ key, label: FILTER_LABELS[key] ?? key, values }];
  });
}

export async function loadTeamDataset(year: number): Promise<DatasetEnvelope> {
  try {
    const relational = await loadSupabaseRankableDataset(year, "teams");
    if (relational?.entities.length) return relational;
  } catch {
    // The replaceable CFBD snapshot remains a safe fallback if relational reads fail.
  }
  if (!process.env.CFBD_API_KEY) return { ...seedTeamDataset(), credentialConfigured: false };
  try {
    const result = await getCollegeFootballSnapshot(year);
    return { ...teamsDataset(result.snapshot), stale: result.stale, refreshMode: result.refreshMode };
  } catch {
    return {
      ...seedTeamDataset(),
      stale: true,
      credentialConfigured: true,
      sourceLabel: "Demo data · CFBD key found, but refresh failed",
      warnings: ["The server found CFBD_API_KEY, but CFBD did not return a valid team snapshot."],
    };
  }
}

export async function loadRankableDataset(
  year: number,
  subject: RankingSubject,
  filters: Record<string, string> = {},
): Promise<DatasetEnvelope> {
  try {
    const relational = await loadSupabaseRankableDataset(year, subject);
    if (relational?.entities.length) return { ...relational, entities: relational.entities.filter((entity) => matchesFilters(entity, filters)) };
  } catch {
    // Continue to the source snapshot/frozen fixture fallback below.
  }
  if (!process.env.CFBD_API_KEY) {
    if (subject === "stadiums") {
      const stadiums = seedStadiumDataset();
      return { ...stadiums, metricDefinitions: inferredMetrics(stadiums.entities) };
    }
    const fallback = seedTeamDataset();
    return subject === "teams"
      ? { ...fallback, credentialConfigured: false, entities: fallback.entities.filter((entity) => matchesFilters(entity, filters)) }
      : { ...fallback, credentialConfigured: false, id: `${fallback.id}-${subject}`, entities: [], sourceLabel: "Demo data · add CFBD_API_KEY for this category" };
  }
  const result = await getCollegeFootballSnapshot(year);
  const entities = entitiesForSubject(result.snapshot, subject).filter((entity) => matchesFilters(entity, filters));
  return envelope(result, subject, entities);
}

export async function loadPollCatalog(year: number): Promise<PollCatalog> {
  try {
    const relational = await loadSupabaseCatalogReceipt(year);
    if (relational && [...relational.categories.values()].some((category) => category.count > 0)) {
      return {
        year,
        connected: true,
        sourceLabel: "Supabase · CollegeFootballData relational snapshot",
        refreshedAt: relational.refreshedAt,
        refreshMode: "saved-snapshot",
        upstreamRequests: relational.upstreamRequests,
        warnings: relational.warnings,
        availableYears: [2025, 2026],
        conferences: [],
        positions: [],
        subjects: RANKABLE_CATEGORIES.map((category) => {
          const receipt = relational.categories.get(category.entityType) ?? { count: 0, metricCount: 0 };
          return {
            id: category.id,
            entityType: category.entityType,
            label: category.label,
            singularLabel: category.singularLabel,
            description: category.description,
            count: receipt.count,
            available: receipt.count > 0,
            group: category.group,
            icon: category.icon,
            exampleQuestions: category.exampleQuestions,
            filters: [],
            metricCount: receipt.metricCount,
          };
        }),
      };
    }
  } catch {
    // Catalogs can still be assembled from the shared CFBD snapshot below.
  }
  if (!process.env.CFBD_API_KEY) {
    const teams = seedTeamDataset();
    const stadiums = seedStadiumDataset();
    const fallbackBySubject = new Map<RankingSubject, RankableEntity[]>([["teams", teams.entities], ["stadiums", stadiums.entities]]);
    return {
      year,
      connected: false,
      sourceLabel: teams.sourceLabel,
      refreshedAt: teams.refreshedAt,
      refreshMode: "fixture",
      upstreamRequests: 0,
      warnings: [],
      availableYears: [2025, 2026],
      conferences: [...new Set(teams.entities.map((entity) => String(entity.attributes.conference)))].sort(),
      positions: [],
      subjects: RANKABLE_CATEGORIES.map((category) => {
        const entities = fallbackBySubject.get(category.id) ?? [];
        return {
          id: category.id,
          entityType: category.entityType,
          label: category.label,
          singularLabel: category.singularLabel,
          description: entities.length ? category.description : `${category.description} Connect CFBD to load this category.`,
          count: entities.length,
          available: entities.length > 0,
          group: category.group,
          icon: category.icon,
          exampleQuestions: category.exampleQuestions,
          filters: filterDefinitions(category.id, entities),
          metricCount: entities.length ? inferredMetrics(entities).length : 0,
        };
      }),
    };
  }

  const result = await getCollegeFootballSnapshot(year);
  const { snapshot } = result;
  const conferences = [...new Set(snapshot.teams.map((entity) => String(entity.attributes.conference)).filter(Boolean))].sort();
  const positions = [...new Set(snapshot.players.map((entity) => String(entity.attributes.position)).filter(Boolean))].sort();
  return {
    year,
    connected: true,
    sourceLabel: snapshot.sourceLabel,
    refreshedAt: snapshot.refreshedAt,
    refreshMode: result.refreshMode,
    upstreamRequests: snapshot.upstreamRequests,
    warnings: snapshot.warnings,
    availableYears: [2025, 2026],
    conferences,
    positions,
    subjects: RANKABLE_CATEGORIES.map((category) => {
      const entities = entitiesForSubject(snapshot, category.id);
      return {
        id: category.id,
        entityType: category.entityType,
        label: category.label,
        singularLabel: category.singularLabel,
        description: category.description,
        count: entities.length,
        available: entities.length > 0,
        group: category.group,
        icon: category.icon,
        exampleQuestions: category.exampleQuestions,
        filters: filterDefinitions(category.id, entities),
        metricCount: snapshot.metricsByEntityType[category.entityType]?.length ?? inferredMetrics(entities).length,
      };
    }),
  };
}
