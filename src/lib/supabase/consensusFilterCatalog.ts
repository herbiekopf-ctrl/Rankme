import "server-only";

import type { AvailableConsensusFilter } from "@/lib/domain/browseConsensus";
import { createAdminSupabaseClient } from "./clients";

type AdminClient = NonNullable<ReturnType<typeof createAdminSupabaseClient>>;

export type ConsensusFilterOption = AvailableConsensusFilter & {
  label: string;
  imageUrl: string | null;
  color: string | null;
  entityType: "team" | "conference" | null;
};

export type ConsensusFilterCategory = {
  id: string;
  label: string;
  options: ConsensusFilterOption[];
};

export async function loadUnlockedConsensusFilterCatalog(userId: string, client: AdminClient): Promise<ConsensusFilterCategory[]> {
  const [affiliationResult, selectionResult] = await Promise.all([
    client.from("user_entity_affiliations").select("affiliation_type").eq("user_id", userId).in("affiliation_type", ["favorite", "conference_fan"]),
    client.from("user_cohort_values").select("cohort_value_id").eq("user_id", userId),
  ]);
  if (affiliationResult.error) throw affiliationResult.error;
  if (selectionResult.error) throw selectionResult.error;

  const unlockedAffiliations = new Set((affiliationResult.data ?? []).map((row) => row.affiliation_type));
  const selectedCohortValueIds = (selectionResult.data ?? []).map((row) => row.cohort_value_id);
  const selectedValuesResult = selectedCohortValueIds.length
    ? await client.from("cohort_values").select("dimension_id").in("id", selectedCohortValueIds)
    : { data: [], error: null };
  if (selectedValuesResult.error) throw selectedValuesResult.error;
  const unlockedDimensionIds = [...new Set((selectedValuesResult.data ?? []).map((value) => value.dimension_id))];

  const [teamResult, conferenceResult, dimensionResult, valueResult] = await Promise.all([
    unlockedAffiliations.has("favorite")
      ? client.from("entities").select("id,name,image_url,color,entity_types!inner(slug)").eq("entity_types.slug", "team").eq("status", "active").is("deleted_at", null).order("name")
      : Promise.resolve({ data: [], error: null }),
    unlockedAffiliations.has("conference_fan")
      ? client.from("entities").select("id,name,image_url,color,entity_types!inner(slug)").eq("entity_types.slug", "conference").eq("status", "active").is("deleted_at", null).order("name")
      : Promise.resolve({ data: [], error: null }),
    unlockedDimensionIds.length
      ? client.from("cohort_dimensions").select("id,slug,name").in("id", unlockedDimensionIds).eq("status", "active").order("name")
      : Promise.resolve({ data: [], error: null }),
    unlockedDimensionIds.length
      ? client.from("cohort_values").select("id,dimension_id,slug,label,sort_order").in("dimension_id", unlockedDimensionIds).order("sort_order")
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (teamResult.error) throw teamResult.error;
  if (conferenceResult.error) throw conferenceResult.error;
  if (dimensionResult.error) throw dimensionResult.error;
  if (valueResult.error) throw valueResult.error;

  const categories: ConsensusFilterCategory[] = [];
  if (unlockedAffiliations.has("favorite")) {
    categories.push({
      id: "favorite_entity",
      label: "Favorite team",
      options: (teamResult.data ?? []).map((entity) => ({ id: `favorite:${entity.id}`, key: "favorite_entity", value: entity.id, label: `${entity.name} fans`, imageUrl: entity.image_url, color: entity.color, entityType: "team" })),
    });
  }
  if (unlockedAffiliations.has("conference_fan")) {
    categories.push({
      id: "conference_affiliation",
      label: "Conference affiliation",
      options: (conferenceResult.data ?? []).map((entity) => ({ id: `conference_fan:${entity.id}`, key: "conference_affiliation", value: entity.id, label: `${entity.name} fans`, imageUrl: entity.image_url, color: entity.color, entityType: "conference" })),
    });
  }
  for (const dimension of dimensionResult.data ?? []) {
    categories.push({
      id: dimension.slug,
      label: dimension.name,
      options: (valueResult.data ?? []).filter((value) => value.dimension_id === dimension.id).map((value) => ({ id: `cohort:${dimension.id}:${value.id}`, key: dimension.slug, value: value.slug, label: value.label, imageUrl: null, color: null, entityType: null })),
    });
  }
  return categories.filter((category) => category.options.length > 0);
}
