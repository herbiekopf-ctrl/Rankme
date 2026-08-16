"use client";

import type { Json } from "./database.types";
import { getBrowserSupabaseClient, requirePermanentRankedUser } from "./browser";
import { customPollEntityType } from "@/lib/domain/customPolls";
import type { CustomPollConfig, DatasetEnvelope, RankingTemplate } from "@/lib/domain/types";
import type { RankingPeriodContext, RankingResponseStatus, ResponseCadence } from "@/lib/domain/rankingPeriods";

function json(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

type TemplateReceipt = { templateId: string; templateVersionId: string; createdBy: string };

type RelationalRankingTarget = { templateVersionId: string; datasetVersionId: string };

function isResponseCadence(value: unknown): value is ResponseCadence {
  return value === "once" || value === "weekly" || value === "seasonal";
}

function isRankingResponseStatus(value: unknown): value is RankingResponseStatus {
  return value === null || value === "draft" || value === "published";
}

function parseRankingPeriod(value: unknown): RankingPeriodContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The saved ranking period is unavailable.");
  const row = value as Record<string, unknown>;
  if (!isResponseCadence(row.responseCadence) || typeof row.periodSlug !== "string" || typeof row.periodTitle !== "string" || !isRankingResponseStatus(row.status)) {
    throw new Error("The saved ranking period is invalid.");
  }
  return {
    responseCadence: row.responseCadence,
    periodSlug: row.periodSlug,
    periodTitle: row.periodTitle,
    season: typeof row.season === "number" ? row.season : new Date().getFullYear(),
    week: typeof row.week === "number" ? row.week : null,
    opensAt: typeof row.opensAt === "string" ? row.opensAt : null,
    closesAt: typeof row.closesAt === "string" ? row.closesAt : null,
    cycleId: typeof row.cycleId === "string" ? row.cycleId : null,
    rankingId: typeof row.rankingId === "string" ? row.rankingId : null,
    status: row.status,
    entityIds: Array.isArray(row.entityIds) ? row.entityIds.filter((id): id is string => typeof id === "string") : [],
    createdAt: typeof row.createdAt === "string" ? row.createdAt : null,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : null,
    publishedAt: typeof row.publishedAt === "string" ? row.publishedAt : null,
  };
}

async function lookupRelationalEntityIds(dataset: DatasetEnvelope, localIds: string[]): Promise<string[]> {
  const client = getBrowserSupabaseClient();
  if (!client || !localIds.length) return [];
  const canonicalKeys = localIds.map((id) => dataset.entities.find((entity) => entity.id === id)?.id ?? id);
  const output = new Map<string, string>();
  for (let index = 0; index < canonicalKeys.length; index += 200) {
    const keys = canonicalKeys.slice(index, index + 200);
    const { data, error } = await client.from("entities").select("id, canonical_key").in("canonical_key", keys);
    if (error) throw error;
    for (const entity of data ?? []) output.set(entity.canonical_key, entity.id);
  }
  return canonicalKeys.map((key) => output.get(key)).filter((id): id is string => Boolean(id));
}

export async function persistCustomPoll(config: CustomPollConfig, dataset: DatasetEnvelope): Promise<CustomPollConfig> {
  const client = getBrowserSupabaseClient();
  if (!client) throw new Error("Saving is unavailable right now.");
  await requirePermanentRankedUser(client);
  if (config.remoteTemplateVersionId) return config;
  const entityIds = await lookupRelationalEntityIds(dataset, dataset.entities.map((entity) => entity.id));
  if (entityIds.length !== dataset.entities.length) {
    throw new Error("Some ranking options are still syncing. Refresh and try again.");
  }
  if (entityIds.length < config.length) throw new Error("The saved option pool is smaller than this ranking.");

  const persistedConfig = { ...config, remoteTemplateId: config.id };
  const { data, error } = await client.rpc("create_my_ranking_template", {
    p_template_id: config.id,
    p_title: config.title,
    p_description: config.description ?? "",
    p_visibility: config.visibility ?? "public",
    p_entity_type_slug: customPollEntityType(config.subject),
    p_ranking_method: config.rankingMethod ?? "manual",
    p_length: config.length,
    p_eligibility_query: json({ subject: config.subject, year: config.year, filters: config.filters }),
    p_display_config: json({ responseCadence: config.responseCadence ?? "once", config: persistedConfig, comparisonMetricKeys: dataset.metricDefinitions?.map((metric) => metric.key) ?? [] }),
    p_entity_ids: entityIds,
  });
  if (error) throw error;
  const receipt = data as unknown as TemplateReceipt;
  return { ...persistedConfig, remoteTemplateVersionId: receipt.templateVersionId };
}

export async function loadPersistedCustomPoll(pollId: string): Promise<CustomPollConfig | null> {
  const client = getBrowserSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.from("ranking_template_versions").select("id, display_config, response_cadence").eq("template_id", pollId).eq("version", 1).maybeSingle();
  if (error) throw error;
  if (!data || typeof data.display_config !== "object" || Array.isArray(data.display_config) || data.display_config === null) return null;
  const config = (data.display_config as Record<string, Json | undefined>).config as unknown as CustomPollConfig | undefined;
  return config ? { ...config, responseCadence: data.response_cadence as ResponseCadence, remoteTemplateId: pollId, remoteTemplateVersionId: data.id } : null;
}

async function lookupDatasetVersionId(year: number): Promise<string> {
  const client = getBrowserSupabaseClient();
  if (!client) throw new Error("Saving is unavailable right now.");
  const { data: savedDataset, error: datasetError } = await client.from("datasets").select("id").eq("slug", "cfbd-season").single();
  if (datasetError) throw datasetError;
  const { data: datasetVersion, error: versionError } = await client
    .from("dataset_versions")
    .select("id")
    .eq("dataset_id", savedDataset.id)
    .eq("season", year)
    .in("status", ["published", "superseded"])
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (versionError) throw versionError;
  if (!datasetVersion) throw new Error(`${year} season data is not ready to publish yet.`);
  return datasetVersion.id;
}

async function lookupBuiltInTemplateVersionId(template: RankingTemplate): Promise<string> {
  const client = getBrowserSupabaseClient();
  if (!client) throw new Error("Saving is unavailable right now.");
  const { data: remoteTemplate, error } = await client
    .from("ranking_templates")
    .select("id, ranking_template_versions(id,version)")
    .eq("slug", `official-${template.id}`)
    .eq("status", "active")
    .single();
  if (error) throw error;
  const version = [...remoteTemplate.ranking_template_versions].sort((left, right) => right.version - left.version)[0];
  if (!version) throw new Error("This ranking is not ready to publish yet.");
  return version.id;
}

async function resolveRankingTarget(template: RankingTemplate, config?: CustomPollConfig): Promise<RelationalRankingTarget | null> {
  const templateVersionId = config?.remoteTemplateVersionId ?? (!config ? await lookupBuiltInTemplateVersionId(template) : null);
  if (!templateVersionId) return null;
  return { templateVersionId, datasetVersionId: await lookupDatasetVersionId(config?.year ?? 2026) };
}

export async function loadCurrentRankingPeriod(template: RankingTemplate, config?: CustomPollConfig): Promise<RankingPeriodContext | null> {
  const client = getBrowserSupabaseClient();
  if (!client) return null;
  await requirePermanentRankedUser(client);
  const target = await resolveRankingTarget(template, config);
  if (!target) return null;
  const { data, error } = await client.rpc("get_my_current_ranking_response", {
    p_template_version_id: target.templateVersionId,
    p_dataset_version_id: target.datasetVersionId,
  });
  if (error) throw error;
  return parseRankingPeriod(data);
}

export async function persistRankingDraft(config: CustomPollConfig, dataset: DatasetEnvelope, orderedIds: string[]): Promise<string> {
  const client = getBrowserSupabaseClient();
  if (!client || !config.remoteTemplateVersionId) throw new Error("This poll is not ready to publish yet.");
  await requirePermanentRankedUser(client);
  const entityIds = await lookupRelationalEntityIds(dataset, orderedIds);
  if (entityIds.length !== orderedIds.length) throw new Error("Some ranking options are still syncing. Refresh and try again.");
  const datasetVersionId = await lookupDatasetVersionId(config.year);
  const storageKey = `ranked:remote-draft:${config.remoteTemplateVersionId}`;
  const existingRankingId = window.localStorage.getItem(storageKey) ?? undefined;
  const { data, error } = await client.rpc("save_my_ranking_draft", {
    p_template_version_id: config.remoteTemplateVersionId,
    p_dataset_version_id: datasetVersionId,
    p_title: config.title,
    p_note: config.description ?? "",
    p_visibility: config.visibility ?? "public",
    p_entity_ids: entityIds,
    p_existing_ranking_id: existingRankingId,
  });
  if (error) throw error;
  window.localStorage.setItem(storageKey, data);
  return data;
}

export async function persistBuiltInRankingDraft(template: RankingTemplate, dataset: DatasetEnvelope, orderedIds: string[], year: number): Promise<string> {
  const client = getBrowserSupabaseClient();
  if (!client) throw new Error("Saving is unavailable right now.");
  await requirePermanentRankedUser(client);
  const templateVersionId = await lookupBuiltInTemplateVersionId(template);
  const entityIds = await lookupRelationalEntityIds(dataset, orderedIds);
  if (entityIds.length !== orderedIds.length) throw new Error("Some ranking options are still syncing. Refresh and try again.");
  const datasetVersionId = await lookupDatasetVersionId(year);
  const storageKey = `ranked:remote-draft:${templateVersionId}`;
  const { data, error } = await client.rpc("save_my_ranking_draft", {
    p_template_version_id: templateVersionId,
    p_dataset_version_id: datasetVersionId,
    p_title: template.title,
    p_note: template.description,
    p_visibility: "public",
    p_entity_ids: entityIds,
    p_existing_ranking_id: window.localStorage.getItem(storageKey) ?? undefined,
  });
  if (error) throw error;
  window.localStorage.setItem(storageKey, data);
  return data;
}

export async function publishPersistedRanking(rankingId: string): Promise<void> {
  const client = getBrowserSupabaseClient();
  if (!client) throw new Error("Publishing is unavailable right now.");
  await requirePermanentRankedUser(client);
  const { error } = await client.rpc("publish_my_ranking", { p_ranking_id: rankingId });
  if (error) throw error;
}
