"use client";

import type { Json } from "./database.types";
import { getBrowserSupabaseClient, requirePermanentRankedUser } from "./browser";
import { customPollEntityType } from "@/lib/domain/customPolls";
import type { CustomPollConfig, DatasetEnvelope, RankingTemplate } from "@/lib/domain/types";

function json(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

type TemplateReceipt = { templateId: string; templateVersionId: string; createdBy: string };

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
  if (!client) throw new Error("Supabase is not connected in this browser.");
  await requirePermanentRankedUser(client);
  if (config.remoteTemplateVersionId) return config;
  const entityIds = await lookupRelationalEntityIds(dataset, dataset.entities.map((entity) => entity.id));
  if (entityIds.length !== dataset.entities.length) {
    throw new Error("The option catalog is not fully saved in Supabase yet. Run the season import, then publish again.");
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
    p_display_config: json({ config: persistedConfig, comparisonMetricKeys: dataset.metricDefinitions?.map((metric) => metric.key) ?? [] }),
    p_entity_ids: entityIds,
  });
  if (error) throw error;
  const receipt = data as unknown as TemplateReceipt;
  return { ...persistedConfig, remoteTemplateVersionId: receipt.templateVersionId };
}

export async function loadPersistedCustomPoll(pollId: string): Promise<CustomPollConfig | null> {
  const client = getBrowserSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.from("ranking_template_versions").select("id, display_config").eq("template_id", pollId).eq("version", 1).maybeSingle();
  if (error) throw error;
  if (!data || typeof data.display_config !== "object" || Array.isArray(data.display_config) || data.display_config === null) return null;
  const config = (data.display_config as Record<string, Json | undefined>).config as unknown as CustomPollConfig | undefined;
  return config ? { ...config, remoteTemplateId: pollId, remoteTemplateVersionId: data.id } : null;
}

export async function persistRankingDraft(config: CustomPollConfig, dataset: DatasetEnvelope, orderedIds: string[]): Promise<string> {
  const client = getBrowserSupabaseClient();
  if (!client || !config.remoteTemplateVersionId) throw new Error("This poll has not been saved to Supabase.");
  await requirePermanentRankedUser(client);
  const entityIds = await lookupRelationalEntityIds(dataset, orderedIds);
  if (entityIds.length !== orderedIds.length) throw new Error("Some ranked options are missing from Supabase. Refresh the season import and try again.");
  const { data: savedDataset, error: datasetError } = await client
    .from("datasets")
    .select("id")
    .eq("slug", "cfbd-season")
    .single();
  if (datasetError) throw datasetError;
  const { data: datasetVersion, error: versionError } = await client
    .from("dataset_versions")
    .select("id")
    .eq("dataset_id", savedDataset.id)
    .eq("season", config.year)
    .in("status", ["published", "superseded"])
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (versionError) throw versionError;
  if (!datasetVersion) throw new Error(`Import the ${config.year} season into Supabase before publishing this ranking.`);
  const storageKey = `ranked:remote-draft:${config.remoteTemplateVersionId}`;
  const existingRankingId = window.localStorage.getItem(storageKey) ?? undefined;
  const { data, error } = await client.rpc("save_my_ranking_draft", {
    p_template_version_id: config.remoteTemplateVersionId,
    p_dataset_version_id: datasetVersion.id,
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
  if (!client) throw new Error("Supabase is not connected in this browser.");
  await requirePermanentRankedUser(client);
  const { data: remoteTemplate, error: templateError } = await client
    .from("ranking_templates")
    .select("id, ranking_template_versions(id)")
    .eq("slug", `official-${template.id}`)
    .eq("status", "active")
    .single();
  if (templateError) throw templateError;
  const version = remoteTemplate.ranking_template_versions[0];
  if (!version) throw new Error("The official ranking template has not been installed in Supabase.");
  const entityIds = await lookupRelationalEntityIds(dataset, orderedIds);
  if (entityIds.length !== orderedIds.length) throw new Error("Some ranked options are missing from Supabase. Refresh the season import and try again.");
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
  if (!datasetVersion) throw new Error(`Import the ${year} season into Supabase before publishing this ranking.`);
  const storageKey = `ranked:remote-draft:${version.id}`;
  const { data, error } = await client.rpc("save_my_ranking_draft", {
    p_template_version_id: version.id,
    p_dataset_version_id: datasetVersion.id,
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
  if (!client) throw new Error("Supabase is not connected in this browser.");
  await requirePermanentRankedUser(client);
  const { error } = await client.rpc("publish_my_ranking", { p_ranking_id: rankingId });
  if (error) throw error;
}
