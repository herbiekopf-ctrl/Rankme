import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/clients";
import type { EntityAnalyticsSnapshot, EntityAttributeValue, EntityGameSnapshot } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const entityId = params.get("entityId") ?? "";
  const season = Number(params.get("season") ?? 2026);
  if (!/^[0-9a-f-]{36}$/i.test(entityId) || !Number.isInteger(season) || season < 2000 || season > 2100) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const client = createAdminSupabaseClient();
  if (!client) return NextResponse.json({ error: "Analytics unavailable" }, { status: 503 });
  try {
    const { data: dataset } = await client.from("datasets").select("id").eq("slug", "cfbd-season").maybeSingle();
    if (!dataset?.id) return NextResponse.json({ entityId, season, games: [] } satisfies EntityAnalyticsSnapshot);
    const { data: version } = await client
      .from("dataset_versions")
      .select("id")
      .eq("dataset_id", dataset.id)
      .eq("season", season)
      .in("status", ["published", "superseded"])
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!version?.id) return NextResponse.json({ entityId, season, games: [] } satisfies EntityAnalyticsSnapshot);
    const { data: relationships, error: relationshipError } = await client.from("entity_relationships").select("from_entity_id,relationship_type").eq("to_entity_id", entityId).in("relationship_type", ["home-team", "away-team"]);
    if (relationshipError) throw relationshipError;
    const gameIds = relationships.map((row) => row.from_entity_id);
    if (!gameIds.length) return NextResponse.json({ entityId, season, games: [] } satisfies EntityAnalyticsSnapshot);
    const [entitiesResult, valuesResult] = await Promise.all([
      client.from("entities").select("id,name").in("id", gameIds),
      client.from("entity_attribute_values").select("entity_id,text_value,number_value,boolean_value,attribute_definitions!inner(key)").eq("dataset_version_id", version.id).in("entity_id", gameIds),
    ]);
    if (entitiesResult.error) throw entitiesResult.error;
    if (valuesResult.error) throw valuesResult.error;
    const attributes = new Map<string, Record<string, EntityAttributeValue>>();
    for (const row of valuesResult.data) {
      const definition = Array.isArray(row.attribute_definitions) ? row.attribute_definitions[0] : row.attribute_definitions;
      if (!definition?.key) continue;
      const value = row.number_value ?? row.boolean_value ?? row.text_value;
      attributes.set(row.entity_id, { ...(attributes.get(row.entity_id) ?? {}), [definition.key]: value });
    }
    const relationshipByGame = new Map(relationships.map((row) => [row.from_entity_id, row.relationship_type]));
    const games: EntityGameSnapshot[] = entitiesResult.data.filter((game) => attributes.has(game.id)).map((game): EntityGameSnapshot => {
      const data = attributes.get(game.id) ?? {};
      const isHome = relationshipByGame.get(game.id) === "home-team";
      const homeTeam = String(data.homeTeam ?? ""); const awayTeam = String(data.awayTeam ?? "");
      const scoreText = typeof data.score === "string" ? data.score : "";
      const scoreParts = scoreText.match(/^(.*) (\d+), (.*) (\d+)$/);
      const awayScore = scoreParts ? Number(scoreParts[2]) : null; const homeScore = scoreParts ? Number(scoreParts[4]) : null;
      const teamScore = isHome ? homeScore : awayScore; const opponentScore = isHome ? awayScore : homeScore;
      const completed = data.completed === true || (teamScore != null && opponentScore != null);
      const result: EntityGameSnapshot["result"] = completed && teamScore != null && opponentScore != null ? teamScore > opponentScore ? "W" : teamScore < opponentScore ? "L" : "T" : null;
      return { id: game.id, week: typeof data.week === "number" ? data.week : null, date: typeof data.date === "string" ? data.date : null, opponent: isHome ? awayTeam : homeTeam, location: isHome ? "home" : "away", completed, result, teamScore, opponentScore, scoreLabel: completed && teamScore != null && opponentScore != null ? `${teamScore}–${opponentScore}` : "Scheduled", venue: typeof data.venue === "string" && data.venue ? data.venue : null };
    }).sort((a, b) => (a.week ?? 99) - (b.week ?? 99) || String(a.date).localeCompare(String(b.date)));
    return NextResponse.json({ entityId, season, games } satisfies EntityAnalyticsSnapshot, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch { return NextResponse.json({ error: "Analytics unavailable" }, { status: 503 }); }
}
