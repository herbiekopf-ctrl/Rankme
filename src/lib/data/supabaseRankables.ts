import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/clients";
import { rankableCategory } from "@/lib/domain/rankableCatalog";
import type { DatasetEnvelope, EntityAttributeValue, MetricDefinition, RankingSubject } from "@/lib/domain/types";

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

function string(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function number(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function attributes(value: unknown): Record<string, EntityAttributeValue> {
  const record = object(value);
  if (!record) return {};
  return Object.fromEntries(Object.entries(record).filter((entry): entry is [string, EntityAttributeValue] => {
    const candidate = entry[1];
    return candidate == null || typeof candidate === "string" || typeof candidate === "number" || typeof candidate === "boolean";
  }));
}

function metricFormat(key: string, unit: unknown): MetricDefinition["format"] {
  const lower = key.toLocaleLowerCase();
  if (unit === "integer" || unit === "decimal" || unit === "percentage" || unit === "signed") return unit;
  if (lower.includes("pct") || lower.includes("percentage") || lower.includes("rate")) return "percentage";
  if (lower.includes("margin") || lower.includes("delta") || lower.includes("plusminus")) return "signed";
  return "decimal";
}

const METRIC_GROUPS = new Set<NonNullable<MetricDefinition["group"]>>(["Resume", "Scoring", "Production", "Efficiency", "Power", "Roster", "History", "Physical", "Other"]);

export async function loadSupabaseRankableDataset(year: number, subject: RankingSubject): Promise<DatasetEnvelope | null> {
  const client = createAdminSupabaseClient();
  if (!client) return null;
  const category = rankableCategory(subject);
  const { data, error } = await client.rpc("get_rankable_dataset", { p_season: year, p_entity_type_slug: category.entityType });
  if (error) throw error;
  const receipt = object(data);
  if (!receipt) return null;
  const rawEntities = Array.isArray(receipt.entities) ? receipt.entities : [];
  const rawMetrics = Array.isArray(receipt.metrics) ? receipt.metrics : [];
  const sourceMetadata = object(receipt.sourceMetadata);
  const warnings = Array.isArray(sourceMetadata?.warnings) ? sourceMetadata.warnings.filter((value): value is string => typeof value === "string") : [];
  const entities = rawEntities.flatMap((value) => {
    const row = object(value);
    if (!row || typeof row.canonicalKey !== "string" || typeof row.name !== "string") return [];
    const rawExternalIds = object(row.externalIds) ?? {};
    return [{
      id: row.canonicalKey,
      relationalId: string(row.relationalId) || undefined,
      entityType: category.entityType,
      name: row.name,
      shortName: string(row.shortName) || undefined,
      aliases: Array.isArray(row.aliases) ? row.aliases.filter((alias): alias is string => typeof alias === "string") : [],
      externalIds: Object.fromEntries(Object.entries(rawExternalIds).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
      imageUrl: string(row.imageUrl) || undefined,
      color: string(row.color) || undefined,
      attributes: attributes(row.attributes),
    }];
  });
  const metricDefinitions = rawMetrics.flatMap((value) => {
    const row = object(value);
    if (!row || typeof row.key !== "string" || typeof row.label !== "string") return [];
    const rawGroup = string(row.metricGroup, "Other") as NonNullable<MetricDefinition["group"]>;
    return [{
      key: row.key,
      label: row.label,
      description: string(row.description, `${row.label} from the saved relational dataset.`),
      format: metricFormat(row.key, row.unit),
      direction: row.direction === "asc" ? "asc" as const : "desc" as const,
      group: METRIC_GROUPS.has(rawGroup) ? rawGroup : "Other" as const,
      source: string(row.source, "CollegeFootballData"),
    } satisfies MetricDefinition];
  });
  return {
    id: `supabase-${string(receipt.datasetVersionId)}-${subject}`,
    version: string(receipt.versionKey),
    source: "collegefootballdata",
    sourceLabel: "Supabase · CollegeFootballData relational snapshot",
    refreshedAt: string(receipt.fetchedAt, new Date(0).toISOString()),
    stale: false,
    connected: true,
    credentialConfigured: true,
    refreshMode: "saved-snapshot",
    upstreamRequests: number(receipt.sourceRequestCount),
    warnings,
    metricDefinitions,
    entities,
  };
}

export type RelationalCatalogReceipt = {
  version: string;
  refreshedAt: string;
  upstreamRequests: number;
  warnings: string[];
  categories: Map<string, { count: number; metricCount: number }>;
};

export async function loadSupabaseCatalogReceipt(year: number): Promise<RelationalCatalogReceipt | null> {
  const client = createAdminSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.rpc("get_rankable_catalog", { p_season: year });
  if (error) throw error;
  const receipt = object(data);
  if (!receipt) return null;
  const sourceMetadata = object(receipt.sourceMetadata);
  const warnings = Array.isArray(sourceMetadata?.warnings) ? sourceMetadata.warnings.filter((value): value is string => typeof value === "string") : [];
  const categories = new Map<string, { count: number; metricCount: number }>();
  for (const value of Array.isArray(receipt.categories) ? receipt.categories : []) {
    const row = object(value);
    if (row && typeof row.entityType === "string") categories.set(row.entityType, { count: number(row.count), metricCount: number(row.metricCount) });
  }
  return {
    version: string(receipt.versionKey),
    refreshedAt: string(receipt.fetchedAt, new Date(0).toISOString()),
    upstreamRequests: number(receipt.sourceRequestCount),
    warnings,
    categories,
  };
}
