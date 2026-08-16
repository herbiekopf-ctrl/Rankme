import "server-only";

import type { CollegeFootballSnapshot } from "@/lib/adapters/cfbd";
import { RANKABLE_CATEGORIES, rankableCategory } from "@/lib/domain/rankableCatalog";
import { curateMetricDefinitions } from "@/lib/domain/metricCatalog";
import type { DatasetEnvelope, PollCatalog, RankableEntity, RankingSubject } from "@/lib/domain/types";
import { loadSupabaseCatalogReceipt, loadSupabaseRankableDataset } from "@/lib/data/supabaseRankables";

function emptyDataset(year: number, subject: RankingSubject, warning: string): DatasetEnvelope {
  return {
    id: `uninitialized-${year}-${subject}`,
    version: `uninitialized-${year}`,
    source: "collegefootballdata",
    sourceLabel: "No imported CFBD dataset",
    refreshedAt: new Date(0).toISOString(),
    stale: true,
    connected: false,
    credentialConfigured: Boolean(process.env.CFBD_API_KEY),
    refreshMode: "saved-snapshot",
    upstreamRequests: 0,
    warnings: [warning],
    metricDefinitions: [],
    entities: [],
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

export async function loadTeamDataset(year: number): Promise<DatasetEnvelope> {
  try {
    const relational = await loadSupabaseRankableDataset(year, "teams");
    if (relational?.entities.length) return relational;
  } catch {}
  return emptyDataset(year, "teams", "Real team data has not been imported. Run the protected initial import after configuring the server secrets.");
}

export async function loadRankableDataset(
  year: number,
  subject: RankingSubject,
  filters: Record<string, string> = {},
): Promise<DatasetEnvelope> {
  try {
    const relational = await loadSupabaseRankableDataset(year, subject);
    if (relational?.entities.length) {
      const entities = relational.entities.filter((entity) => matchesFilters(entity, filters));
      return {
        ...relational,
        entities,
        metricDefinitions: curateMetricDefinitions(rankableCategory(subject).entityType, relational.metricDefinitions ?? [], entities),
      };
    }
  } catch {}
  return emptyDataset(year, subject, `Real ${rankableCategory(subject).label.toLocaleLowerCase()} data has not been imported for ${year}.`);
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
          const receipt = relational.categories.get(category.entityType) ?? { count: 0, metricCount: 0, populatedMetricCount: 0 };
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
  } catch {}
  return {
    year,
    connected: false,
    sourceLabel: "No imported CFBD dataset",
    refreshedAt: new Date(0).toISOString(),
    refreshMode: "saved-snapshot",
    upstreamRequests: 0,
    warnings: ["Run the protected initial import to populate real options and metrics."],
    availableYears: [2025, 2026],
    conferences: [],
    positions: [],
    subjects: RANKABLE_CATEGORIES.map((category) => {
      return {
        id: category.id,
        entityType: category.entityType,
        label: category.label,
        singularLabel: category.singularLabel,
        description: category.description,
        count: 0,
        available: false,
        group: category.group,
        icon: category.icon,
        exampleQuestions: category.exampleQuestions,
        filters: [],
        metricCount: 0,
      };
    }),
  };
}
