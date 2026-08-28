import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/clients";
import { buildTeamStrengthIndex, signatureResults, TEAM_STRENGTH_KEYS } from "@/lib/domain/scheduleInsights";
import type { EntityAnalyticsSnapshot, EntityAttributeValue, EntityGameSnapshot } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function emptySnapshot(entityId: string, season: number): EntityAnalyticsSnapshot {
  return { entityId, season, games: [], bestWin: null, worstLoss: null };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const entityId = params.get("entityId") ?? "";
  const season = Number(params.get("season") ?? 2026);
  if (!/^[0-9a-f-]{36}$/i.test(entityId) || !Number.isInteger(season) || season < 2000 || season > 2100) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const client = createAdminSupabaseClient();
  if (!client) return NextResponse.json({ error: "Analytics unavailable" }, { status: 503 });

  try {
    const { data: dataset } = await client.from("datasets").select("id").eq("slug", "cfbd-season").maybeSingle();
    if (!dataset?.id) return NextResponse.json(emptySnapshot(entityId, season));
    const { data: version } = await client.from("dataset_versions").select("id").eq("dataset_id", dataset.id).eq("season", season).in("status", ["published", "superseded"]).order("published_at", { ascending: false }).limit(1).maybeSingle();
    if (!version?.id) return NextResponse.json(emptySnapshot(entityId, season));

    const { data: targetRelationships, error: relationshipError } = await client.from("entity_relationships").select("from_entity_id,relationship_type").eq("to_entity_id", entityId).in("relationship_type", ["home-team", "away-team"]);
    if (relationshipError) throw relationshipError;
    const gameIds = targetRelationships.map((row) => row.from_entity_id);
    if (!gameIds.length) return NextResponse.json(emptySnapshot(entityId, season));

    const [allRelationshipsResult, gameEntitiesResult, gameValuesResult, teamTypeResult] = await Promise.all([
      client.from("entity_relationships").select("from_entity_id,to_entity_id,relationship_type").in("from_entity_id", gameIds).in("relationship_type", ["home-team", "away-team"]),
      client.from("entities").select("id,name").in("id", gameIds),
      client.from("entity_attribute_values").select("entity_id,text_value,number_value,boolean_value,attribute_definitions!inner(key)").eq("dataset_version_id", version.id).in("entity_id", gameIds),
      client.from("entity_types").select("id").eq("slug", "team").maybeSingle(),
    ]);
    if (allRelationshipsResult.error) throw allRelationshipsResult.error;
    if (gameEntitiesResult.error) throw gameEntitiesResult.error;
    if (gameValuesResult.error) throw gameValuesResult.error;
    if (teamTypeResult.error) throw teamTypeResult.error;

    const opponentIdByGame = new Map<string, string>();
    for (const relationship of allRelationshipsResult.data) {
      if (relationship.to_entity_id !== entityId) opponentIdByGame.set(relationship.from_entity_id, relationship.to_entity_id);
    }
    const opponentIds = [...new Set(opponentIdByGame.values())];
    const opponentEntitiesResult = opponentIds.length
      ? await client.from("entities").select("id,name,image_url,color").in("id", opponentIds)
      : { data: [], error: null };
    if (opponentEntitiesResult.error) throw opponentEntitiesResult.error;

    const strengthValues: Array<{ entityId: string; key: string; value: number }> = [];
    if (teamTypeResult.data?.id) {
      const [teamsResult, definitionsResult] = await Promise.all([
        client.from("entities").select("id").eq("entity_type_id", teamTypeResult.data.id).eq("status", "active").is("deleted_at", null),
        client.from("attribute_definitions").select("id,key").eq("entity_type_id", teamTypeResult.data.id).in("key", TEAM_STRENGTH_KEYS),
      ]);
      if (teamsResult.error) throw teamsResult.error;
      if (definitionsResult.error) throw definitionsResult.error;
      const teamIds = teamsResult.data.map((team) => team.id);
      const definitionIds = definitionsResult.data.map((definition) => definition.id);
      if (teamIds.length && definitionIds.length) {
        const { data: values, error: valuesError } = await client.from("entity_attribute_values").select("entity_id,attribute_definition_id,number_value").eq("dataset_version_id", version.id).in("entity_id", teamIds).in("attribute_definition_id", definitionIds);
        if (valuesError) throw valuesError;
        const keyByDefinitionId = new Map(definitionsResult.data.map((definition) => [definition.id, definition.key]));
        for (const value of values) {
          const key = keyByDefinitionId.get(value.attribute_definition_id);
          if (key && typeof value.number_value === "number") strengthValues.push({ entityId: value.entity_id, key, value: value.number_value });
        }
      }
    }

    const attributes = new Map<string, Record<string, EntityAttributeValue>>();
    for (const row of gameValuesResult.data) {
      const definition = Array.isArray(row.attribute_definitions) ? row.attribute_definitions[0] : row.attribute_definitions;
      if (!definition?.key) continue;
      const value = row.number_value ?? row.boolean_value ?? row.text_value;
      attributes.set(row.entity_id, { ...(attributes.get(row.entity_id) ?? {}), [definition.key]: value });
    }
    const targetRelationshipByGame = new Map(targetRelationships.map((row) => [row.from_entity_id, row.relationship_type]));
    const opponentById = new Map((opponentEntitiesResult.data ?? []).map((opponent) => [opponent.id, opponent]));
    const strengthByEntityId = buildTeamStrengthIndex(strengthValues);

    const games: EntityGameSnapshot[] = gameEntitiesResult.data.filter((game) => attributes.has(game.id)).map((game): EntityGameSnapshot => {
      const data = attributes.get(game.id) ?? {};
      const isHome = targetRelationshipByGame.get(game.id) === "home-team";
      const homeTeam = String(data.homeTeam ?? "");
      const awayTeam = String(data.awayTeam ?? "");
      const scoreText = typeof data.score === "string" ? data.score : "";
      const scoreParts = scoreText.match(/^(.*) (\d+), (.*) (\d+)$/);
      const awayScore = scoreParts ? Number(scoreParts[2]) : null;
      const homeScore = scoreParts ? Number(scoreParts[4]) : null;
      const teamScore = isHome ? homeScore : awayScore;
      const opponentScore = isHome ? awayScore : homeScore;
      const completed = data.completed === true || (teamScore != null && opponentScore != null);
      const result: EntityGameSnapshot["result"] = completed && teamScore != null && opponentScore != null ? teamScore > opponentScore ? "W" : teamScore < opponentScore ? "L" : "T" : null;
      const opponentEntityId = opponentIdByGame.get(game.id) ?? null;
      const opponent = opponentEntityId ? opponentById.get(opponentEntityId) : null;
      const strength = opponentEntityId ? strengthByEntityId.get(opponentEntityId) : null;
      return {
        id: game.id,
        week: typeof data.week === "number" ? data.week : null,
        date: typeof data.date === "string" ? data.date : null,
        opponent: opponent?.name ?? (isHome ? awayTeam : homeTeam),
        opponentEntityId,
        opponentImageUrl: opponent?.image_url ?? null,
        opponentColor: opponent?.color ?? null,
        location: data.neutralSite === true ? "neutral" : isHome ? "home" : "away",
        completed,
        result,
        teamScore,
        opponentScore,
        scoreLabel: completed && teamScore != null && opponentScore != null ? `${teamScore}–${opponentScore}` : "Scheduled",
        venue: typeof data.venue === "string" && data.venue ? data.venue : null,
        difficultyScore: strength?.score ?? null,
        difficultyRank: strength?.rank ?? null,
        difficultyFieldSize: strength?.fieldSize ?? null,
        difficultyLabel: strength?.label ?? null,
        difficultyMetric: strength?.primaryMetric ?? null,
        difficultyMetricValue: strength?.primaryValue ?? null,
      };
    }).sort((left, right) => (left.week ?? 99) - (right.week ?? 99) || String(left.date).localeCompare(String(right.date)));
    const signature = signatureResults(games);
    return NextResponse.json({ entityId, season, games, ...signature } satisfies EntityAnalyticsSnapshot, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch {
    return NextResponse.json({ error: "Analytics unavailable" }, { status: 503 });
  }
}
