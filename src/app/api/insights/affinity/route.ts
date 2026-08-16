import { NextResponse } from "next/server";
import { z } from "zod";
import type { Json } from "@/lib/supabase/database.types";
import { createAdminSupabaseClient } from "@/lib/supabase/clients";

const requestSchema = z.object({
  anchorTemplateVersionId: z.string().uuid(),
  anchorEntityId: z.string().uuid(),
  anchorMaxPosition: z.number().int().min(1).max(50),
  compareTemplateVersionId: z.string().uuid(),
  filters: z.record(z.string(), z.string()).default({}),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the comparison options and try again." }, { status: 400 });
  const client = createAdminSupabaseClient();
  if (!client) return NextResponse.json({ error: "Community comparisons are unavailable." }, { status: 503 });
  const { data, error } = await client.rpc("get_ranking_affinity", {
    p_anchor_template_version_id: parsed.data.anchorTemplateVersionId,
    p_anchor_cycle_id: null as unknown as string,
    p_anchor_entity_id: parsed.data.anchorEntityId,
    p_anchor_max_position: parsed.data.anchorMaxPosition,
    p_compare_template_version_id: parsed.data.compareTemplateVersionId,
    p_compare_cycle_id: null as unknown as string,
    p_filters: parsed.data.filters as Json,
    p_min_cohort: 25,
  });
  if (error) return NextResponse.json({ error: "Community comparison could not be loaded." }, { status: 503 });
  const result = data as Record<string, unknown>;
  const rankingPatterns = Array.isArray(result.rankingPatterns) ? result.rankingPatterns : [];
  const entityIds = rankingPatterns.flatMap((pattern) => typeof pattern === "object" && pattern && "entityId" in pattern && typeof pattern.entityId === "string" ? [pattern.entityId] : []);
  const { data: entities } = entityIds.length ? await client.from("entities").select("id, name").in("id", entityIds) : { data: [] };
  const names = new Map((entities ?? []).map((entity) => [entity.id, entity.name]));
  return NextResponse.json({
    ...result,
    rankingPatterns: rankingPatterns.map((pattern) => typeof pattern === "object" && pattern && "entityId" in pattern ? { ...pattern, name: names.get(String(pattern.entityId)) ?? "Unknown option" } : pattern),
  });
}
