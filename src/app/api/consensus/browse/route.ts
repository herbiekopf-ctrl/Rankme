import { NextResponse } from "next/server";
import { z } from "zod";
import { buildUnlockedConsensusFilters } from "@/lib/domain/browseConsensus";
import { createAdminSupabaseClient } from "@/lib/supabase/clients";
import { loadUnlockedConsensusFilterCatalog } from "@/lib/supabase/consensusFilterCatalog";
import type { Json } from "@/lib/supabase/database.types";

const requestSchema = z.object({
  targets: z.array(z.object({
    templateVersionId: z.string().uuid(),
    cycleId: z.string().uuid(),
  })).max(50),
  filterIds: z.array(z.string().min(1).max(100)).max(8).default([]),
});

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the consensus filters and try again." }, { status: 400 });
  const client = createAdminSupabaseClient();
  if (!client) return NextResponse.json({ error: "Community consensus is unavailable." }, { status: 503 });

  let filters: Record<string, string> = {};
  if (parsed.data.filterIds.length) {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: "Sign in to use your profile filters." }, { status: 401 });
    const { data: authData, error: authError } = await client.auth.getUser(token);
    if (authError || !authData.user || authData.user.is_anonymous) {
      return NextResponse.json({ error: "Sign in to use your profile filters." }, { status: 401 });
    }
    try {
      const catalog = await loadUnlockedConsensusFilterCatalog(authData.user.id, client);
      const selected = buildUnlockedConsensusFilters(parsed.data.filterIds, catalog.flatMap((category) => category.options));
      if (!selected) return NextResponse.json({ error: "Choose a value from a demographic category you unlocked." }, { status: 403 });
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
