"use client";

import type { Json } from "./database.types";
import type { CustomMetricFormula, UserCustomMetric } from "@/lib/domain/types";
import { getBrowserSupabaseClient, requirePermanentRankedUser } from "./browser";

function parseFormula(value: Json): CustomMetricFormula | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  const components = value.components;
  if (value.version !== 1 || !Array.isArray(components)) return null;
  const parsed = components.flatMap((component) => {
    if (!component || Array.isArray(component) || typeof component !== "object") return [];
    return typeof component.metricKey === "string" && typeof component.weight === "number"
      ? [{ metricKey: component.metricKey, weight: component.weight }]
      : [];
  });
  return parsed.length ? { version: 1, normalization: "percentile", components: parsed } : null;
}

function toMetric(row: {
  id: string; user_id: string; name: string; entity_type_slug: string; formula: Json;
  visibility: string; created_at: string; updated_at: string;
}): UserCustomMetric | null {
  const formula = parseFormula(row.formula);
  if (!formula) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    entityType: row.entity_type_slug,
    formula,
    visibility: row.visibility as UserCustomMetric["visibility"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadMyCustomMetrics(entityType?: string): Promise<UserCustomMetric[]> {
  const client = getBrowserSupabaseClient();
  if (!client) return [];
  const user = await requirePermanentRankedUser(client);
  let query = client.from("user_custom_metrics").select("*").eq("user_id", user.id).order("updated_at", { ascending: false });
  if (entityType) query = query.eq("entity_type_slug", entityType);
  const { data, error } = await query;
  if (error) throw error;
  return data.flatMap((row) => {
    const metric = toMetric(row);
    return metric ? [metric] : [];
  });
}

export async function saveMyCustomMetric(input: {
  id?: string;
  name: string;
  entityType: string;
  formula: CustomMetricFormula;
}): Promise<UserCustomMetric> {
  const client = getBrowserSupabaseClient();
  if (!client) throw new Error("Sign in to save personal metrics.");
  const user = await requirePermanentRankedUser(client);
  const payload = {
    user_id: user.id,
    name: input.name.trim(),
    entity_type_slug: input.entityType,
    formula: input.formula as unknown as Json,
    visibility: "private",
  };
  const query = input.id
    ? client.from("user_custom_metrics").update(payload).eq("id", input.id).eq("user_id", user.id)
    : client.from("user_custom_metrics").insert(payload);
  const { data, error } = await query.select("*").single();
  if (error) throw error;
  const metric = toMetric(data);
  if (!metric) throw new Error("The saved metric formula was invalid.");
  return metric;
}

export async function deleteMyCustomMetric(id: string): Promise<void> {
  const client = getBrowserSupabaseClient();
  if (!client) throw new Error("Sign in to manage personal metrics.");
  const user = await requirePermanentRankedUser(client);
  const { error } = await client.from("user_custom_metrics").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw error;
}
