import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildUnlockedConsensusFilters,
  type ConsensusFilterSelection,
  type UnlockedConsensusCategory,
} from "@/lib/domain/browseConsensus";
import { createAdminSupabaseClient } from "@/lib/supabase/clients";
import type { Json } from "@/lib/supabase/database.types";

const requestSchema = z.object({
  targets: z.array(z.object({
    templateVersionId: z.string().uuid(),
    cycleId: z.string().uuid(),
  })).max(50),
  filters: z.array(z.object({
    categoryId: z.string().min(1).max(100),
    optionId: z.string().uuid(),
  })).max(8).default([]),
});

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
}

async function unlockedProfileCategories(
  userId: string,
  requested: ConsensusFilterSelection[],
  client: NonNullable<ReturnType<typeof createAdminSupabaseClient>>,
): Promise<UnlockedConsensusCategory[]> {
  const [affiliationResult, selectionResult] = await Promise.all([
    client
      .from("user_entity_affiliations")
      .select("entity_id,affiliation_type")
      .eq("user_id", userId)
      .in("affiliation_type", ["favorite", "conference_fan"]),
    client.from("user_cohort_values").select("cohort_value_id").eq("user_id", userId),
  ]);
  if (affiliationResult.error) throw affiliationResult.error;
  if (selectionResult.error) throw selectionResult.error;

  const affiliationTypes = new Set((affiliationResult.data ?? []).map((row) => row.affiliation_type));
  const cohortValueIds = (selectionResult.data ?? []).map((row) => row.cohort_value_id);
  const { data: selectedValues, error: selectedValueError } = cohortValueIds.length
    ? await client.from("cohort_values").select("id,dimension_id").in("id", cohortValueIds)
    : { data: [], error: null };
  if (selectedValueError) throw selectedValueError;
  const dimensionIds = [...new Set((selectedValues ?? []).map((value) => value.dimension_id))];
  const { data: dimensions, error: dimensionError } = dimensionIds.length
    ? await client
      .from("cohort_dimensions")
      .select("id,slug")
      .in("id", dimensionIds)
      .eq("status", "active")
      .neq("collection_method", "derived")
    : { data: [], error: null };
  if (dimensionError) throw dimensionError;

  const requestedOptionIds = [...new Set(requested.map((selection) => selection.optionId))];
  const [entityResult, valueResult] = await Promise.all([
    requestedOptionIds.length
      ? client
        .from("entities")
        .select("id,entity_types!inner(slug)")
        .in("id", requestedOptionIds)
        .in("entity_types.slug", ["team", "conference"])
        .eq("status", "active")
      : Promise.resolve({ data: [], error: null }),
    requestedOptionIds.length
      ? client.from("cohort_values").select("id,slug,dimension_id").in("id", requestedOptionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (entityResult.error) throw entityResult.error;
  if (valueResult.error) throw valueResult.error;

  const categories: UnlockedConsensusCategory[] = [];
  if (affiliationTypes.has("favorite")) {
    categories.push({
      id: "favorite",
      key: "favorite_entity",
      options: (entityResult.data ?? []).flatMap((entity) => {
        const type = Array.isArray(entity.entity_types) ? entity.entity_types[0] : entity.entity_types;
        return type?.slug === "team" ? [{ id: entity.id, value: entity.id }] : [];
      }),
    });
  }
  if (affiliationTypes.has("conference_fan")) {
    categories.push({
      id: "conference_fan",
      key: "conference_affiliation",
      options: (entityResult.data ?? []).flatMap((entity) => {
        const type = Array.isArray(entity.entity_types) ? entity.entity_types[0] : entity.entity_types;
        return type?.slug === "conference" ? [{ id: entity.id, value: entity.id }] : [];
      }),
    });
  }
  for (const dimension of dimensions ?? []) {
    categories.push({
      id: `cohort:${dimension.id}`,
      key: dimension.slug,
      options: (valueResult.data ?? [])
        .filter((value) => value.dimension_id === dimension.id)
        .map((value) => ({ id: value.id, value: value.slug })),
    });
  }
  return categories;
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the consensus filters and try again." }, { status: 400 });
  const client = createAdminSupabaseClient();
  if (!client) return NextResponse.json({ error: "Community consensus is unavailable." }, { status: 503 });

  let filters: Record<string, string> = {};
  if (parsed.data.filters.length) {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: "Sign in to use your profile filters." }, { status: 401 });
    const { data: authData, error: authError } = await client.auth.getUser(token);
    if (authError || !authData.user || authData.user.is_anonymous) {
      return NextResponse.json({ error: "Sign in to use your profile filters." }, { status: 401 });
    }
    try {
      const unlocked = await unlockedProfileCategories(authData.user.id, parsed.data.filters, client);
      const selected = buildUnlockedConsensusFilters(parsed.data.filters, unlocked);
      if (!selected) return NextResponse.json({ error: "Choose values from profile categories you completed." }, { status: 403 });
      filters = selected;
    } catch {
      return NextResponse.json({ error: "Your profile filters could not be loaded." }, { status: 503 });
    }
  }

  const { data, error } = await client.rpc("get_browse_poll_consensus", {
    p_targets: parsed.data.targets.map((target) => ({
      template_version_id: target.templateVersionId,
      cycle_id: target.cycleId,
    })) as Json,
    p_filters: filters as Json,
    p_min_cohort: 5,
  });
  if (error) return NextResponse.json({ error: "Community consensus could not be loaded." }, { status: 503 });

  return NextResponse.json({ results: Array.isArray(data) ? data : [] }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
