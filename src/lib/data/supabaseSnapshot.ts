import "server-only";

import type { Database, Json } from "@/lib/supabase/database.types";
import type { CollegeFootballSnapshot } from "@/lib/adapters/cfbd";
import type { MetricDefinition, RankableEntity } from "@/lib/domain/types";
import { createAdminSupabaseClient } from "@/lib/supabase/clients";

type EntityInsert = Database["public"]["Tables"]["entities"]["Insert"];
type AttributeDefinitionInsert = Database["public"]["Tables"]["attribute_definitions"]["Insert"];
type AttributeValueInsert = Database["public"]["Tables"]["entity_attribute_values"]["Insert"];

export type SnapshotPersistenceResult = {
  persisted: boolean;
  reason?: "missing-server-secret" | "already-published";
  versionId?: string;
  entityCount?: number;
  attributeValueCount?: number;
};

function chunks<T>(values: T[], size = 500): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size));
  return output;
}

function humanize(value: string): string {
  return value
    .replace(/^stat:/, "")
    .replaceAll(":", " · ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function allSnapshotEntities(snapshot: CollegeFootballSnapshot): RankableEntity[] {
  const unique = new Map<string, RankableEntity>();
  for (const entity of [
    ...snapshot.teams,
    ...snapshot.players,
    ...snapshot.coaches,
    ...snapshot.conferences,
    ...snapshot.games,
    ...snapshot.mascots,
    ...snapshot.towns,
    ...snapshot.stadiums,
    ...snapshot.recruitingClasses,
    ...snapshot.recruits,
    ...snapshot.transfers,
    ...snapshot.units,
    ...snapshot.teamSeasons,
    ...snapshot.draftPicks,
  ]) unique.set(entity.id, entity);
  return [...unique.values()];
}

function metricMap(snapshot: CollegeFootballSnapshot): Map<string, MetricDefinition> {
  return new Map(Object.values(snapshot.metricsByEntityType).flat().map((metric) => [metric.key, metric]));
}

export async function persistCollegeFootballSnapshot(snapshot: CollegeFootballSnapshot): Promise<SnapshotPersistenceResult> {
  const client = createAdminSupabaseClient();
  if (!client) return { persisted: false, reason: "missing-server-secret" };

  const [{ data: domain, error: domainError }, { data: source, error: sourceError }, { data: dataset, error: datasetError }] = await Promise.all([
    client.from("domains").select("id").eq("slug", "college-football").single(),
    client.from("data_sources").select("id").eq("slug", "cfbd").single(),
    client.from("datasets").select("id, active_version_id").eq("slug", "cfbd-season").single(),
  ]);
  if (domainError || sourceError || datasetError || !domain || !source || !dataset) {
    throw new Error("Ranked's Supabase foundation is missing required catalog rows");
  }

  const { data: existing, error: existingError } = await client
    .from("dataset_versions")
    .select("id, status")
    .eq("dataset_id", dataset.id)
    .eq("version_key", snapshot.version)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.status === "published") return { persisted: false, reason: "already-published", versionId: existing.id };

  const { data: version, error: versionError } = await client
    .from("dataset_versions")
    .upsert({
      dataset_id: dataset.id,
      version_key: snapshot.version,
      season: snapshot.year,
      status: "staging",
      fetched_at: snapshot.refreshedAt,
      source_request_count: snapshot.upstreamRequests,
      source_metadata: { provider: "cfbd", warnings: snapshot.warnings } as Json,
    }, { onConflict: "dataset_id,version_key" })
    .select("id")
    .single();
  if (versionError || !version) throw versionError ?? new Error("Could not stage dataset version");

  const { data: job } = await client.from("source_jobs").insert({
    dataset_id: dataset.id,
    dataset_version_id: version.id,
    status: "running",
    started_at: new Date().toISOString(),
    request_count: snapshot.upstreamRequests,
    metadata: { adapter: "cfbd-v2", snapshotVersion: snapshot.version } as Json,
  }).select("id").single();

  try {
    const { data: entityTypes, error: entityTypeError } = await client
      .from("entity_types")
      .select("id, slug")
      .eq("domain_id", domain.id);
    if (entityTypeError || !entityTypes) throw entityTypeError ?? new Error("Entity taxonomy is unavailable");
    const entityTypeIds = new Map(entityTypes.map((row) => [row.slug, row.id]));
    const snapshotEntities = allSnapshotEntities(snapshot);
    const entityRows: EntityInsert[] = snapshotEntities.map((entity) => {
      const typeId = entityTypeIds.get(entity.entityType);
      if (!typeId) throw new Error(`Unknown entity type: ${entity.entityType}`);
      return {
        domain_id: domain.id,
        entity_type_id: typeId,
        canonical_key: entity.id,
        name: entity.name,
        short_name: entity.shortName,
        image_url: entity.imageUrl,
        color: entity.color,
        status: "active",
      };
    });
    const persistedEntities: { id: string; canonical_key: string; entity_type_id: string; name: string }[] = [];
    for (const batch of chunks(entityRows)) {
      const { data, error } = await client
        .from("entities")
        .upsert(batch, { onConflict: "domain_id,entity_type_id,canonical_key" })
        .select("id, canonical_key, entity_type_id, name");
      if (error) throw error;
      persistedEntities.push(...(data ?? []));
    }
    const persistedByKey = new Map(persistedEntities.map((entity) => [entity.canonical_key, entity]));
    const persistedByTypeAndName = new Map(persistedEntities.map((entity) => {
      const type = entityTypes.find((candidate) => candidate.id === entity.entity_type_id)?.slug;
      return [`${type}:${entity.name}`, entity.id];
    }));

    const aliasRows = snapshotEntities.flatMap((entity) => {
      const stored = persistedByKey.get(entity.id);
      if (!stored) return [];
      return [...new Set(entity.aliases ?? [])].filter(Boolean).map((alias) => ({ entity_id: stored.id, alias, alias_type: "search" }));
    });
    for (const batch of chunks(aliasRows)) {
      const { error } = await client.from("entity_aliases").upsert(batch, { onConflict: "entity_id,normalized_alias", ignoreDuplicates: true });
      if (error) throw error;
    }

    const externalIdRows = snapshotEntities.flatMap((entity) => {
      const stored = persistedByKey.get(entity.id);
      if (!stored) return [];
      return Object.entries(entity.externalIds ?? {}).map(([sourceSlug, externalId]) => ({ entity_id: stored.id, source_slug: sourceSlug, external_id: externalId }));
    });
    for (const batch of chunks(externalIdRows)) {
      const { error } = await client.from("entity_external_ids").upsert(batch, { onConflict: "source_slug,external_id" });
      if (error) throw error;
    }

    const metrics = metricMap(snapshot);
    const definitionRowsByKey = new Map<string, AttributeDefinitionInsert>();
    for (const entity of snapshotEntities) {
      const typeId = entityTypeIds.get(entity.entityType);
      if (!typeId) continue;
      for (const [key, value] of Object.entries(entity.attributes)) {
        if (value == null) continue;
        const metric = metrics.get(key);
        definitionRowsByKey.set(`${typeId}:${key}`, {
          entity_type_id: typeId,
          source_id: source.id,
          key,
          label: metric?.label ?? humanize(key),
          description: metric?.description,
          value_type: typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "text",
          unit: metric?.format,
          metric_group: metric?.group,
          direction: metric?.direction,
          freshness: "weekly",
          public_visible: true,
        });
      }
    }
    const definitions: { id: string; entity_type_id: string; key: string }[] = [];
    for (const batch of chunks([...definitionRowsByKey.values()])) {
      const { data, error } = await client
        .from("attribute_definitions")
        .upsert(batch, { onConflict: "entity_type_id,key" })
        .select("id, entity_type_id, key");
      if (error) throw error;
      definitions.push(...(data ?? []));
    }
    const definitionIds = new Map(definitions.map((definition) => [`${definition.entity_type_id}:${definition.key}`, definition.id]));
    const attributeValues: AttributeValueInsert[] = [];
    for (const entity of snapshotEntities) {
      const stored = persistedByKey.get(entity.id);
      const typeId = entityTypeIds.get(entity.entityType);
      if (!stored || !typeId) continue;
      for (const [key, value] of Object.entries(entity.attributes)) {
        if (value == null) continue;
        const definitionId = definitionIds.get(`${typeId}:${key}`);
        if (!definitionId) continue;
        attributeValues.push({
          dataset_version_id: version.id,
          entity_id: stored.id,
          attribute_definition_id: definitionId,
          effective_at: snapshot.refreshedAt,
          ...(typeof value === "number" ? { number_value: value } : typeof value === "boolean" ? { boolean_value: value } : { text_value: String(value) }),
        });
      }
    }
    for (const batch of chunks(attributeValues)) {
      const { error } = await client.from("entity_attribute_values").upsert(batch, { onConflict: "dataset_version_id,entity_id,attribute_definition_id" });
      if (error) throw error;
    }

    const relationshipRows: Database["public"]["Tables"]["entity_relationships"]["Insert"][] = [];
    const validFrom = `${snapshot.year}-01-01`;
    function relate(fromKey: string, toType: string, toName: string, relationshipType: string, metadata: Json = {}) {
      const from = persistedByKey.get(fromKey)?.id;
      const to = persistedByTypeAndName.get(`${toType}:${toName}`);
      if (from && to) relationshipRows.push({ from_entity_id: from, to_entity_id: to, relationship_type: relationshipType, valid_from: validFrom, metadata });
    }
    for (const entity of snapshotEntities) {
      if (entity.entityType === "team") relate(entity.id, "conference", String(entity.attributes.conference), "member-of");
      if (entity.entityType === "player") relate(entity.id, "team", String(entity.attributes.team), "plays-for");
      if (entity.entityType === "coach") relate(entity.id, "team", String(entity.attributes.team), "coaches");
      if (entity.entityType === "stadium") relate(entity.id, "team", String(entity.attributes.team), "home-venue-for");
      if (entity.entityType === "mascot") relate(entity.id, "team", String(entity.attributes.school), "represents");
      if (entity.entityType === "recruiting-class") relate(entity.id, "team", String(entity.attributes.team), "recruiting-class-for");
      if (entity.entityType === "recruit") relate(entity.id, "team", String(entity.attributes.committedTo), "committed-to");
      if (entity.entityType === "transfer") {
        relate(entity.id, "team", String(entity.attributes.origin), "transferred-from");
        if (entity.attributes.destination !== "Uncommitted") relate(entity.id, "team", String(entity.attributes.destination), "transferred-to");
      }
      if (entity.entityType === "unit") relate(entity.id, "team", String(entity.attributes.team), "unit-of");
      if (entity.entityType === "team-season") relate(entity.id, "team", String(entity.attributes.team), "season-of");
      if (entity.entityType === "draft-pick") relate(entity.id, "team", String(entity.attributes.collegeTeam), "drafted-from");
      if (entity.entityType === "game") {
        relate(entity.id, "team", String(entity.attributes.homeTeam), "home-team");
        relate(entity.id, "team", String(entity.attributes.awayTeam), "away-team");
      }
    }
    for (const batch of chunks(relationshipRows)) {
      const { error } = await client.from("entity_relationships").upsert(batch, { onConflict: "from_entity_id,to_entity_id,relationship_type,valid_from" });
      if (error) throw error;
    }

    if (dataset.active_version_id && dataset.active_version_id !== version.id) {
      const { error } = await client.from("dataset_versions").update({ status: "superseded" }).eq("id", dataset.active_version_id).eq("status", "published");
      if (error) throw error;
    }
    const completedAt = new Date().toISOString();
    const { error: publishError } = await client.from("dataset_versions").update({
      status: "published",
      published_at: completedAt,
      row_count: snapshotEntities.length,
      validation_summary: { warnings: snapshot.warnings.length, entityTypes: entityTypes.length } as Json,
    }).eq("id", version.id);
    if (publishError) throw publishError;
    const { error: activateError } = await client.from("datasets").update({ active_version_id: version.id }).eq("id", dataset.id);
    if (activateError) throw activateError;
    if (job) {
      await client.from("validation_results").insert([
        { source_job_id: job.id, check_name: "entity_count", status: snapshotEntities.length > 100 ? "passed" : "warning", expected_value: { minimum: 100 }, actual_value: { count: snapshotEntities.length } },
        { source_job_id: job.id, check_name: "canonical_ids", status: persistedEntities.length === snapshotEntities.length ? "passed" : "failed", expected_value: { count: snapshotEntities.length }, actual_value: { count: persistedEntities.length } },
      ]);
      await client.from("source_jobs").update({ status: "published", completed_at: completedAt, rows_received: snapshotEntities.length }).eq("id", job.id);
    }
    return { persisted: true, versionId: version.id, entityCount: snapshotEntities.length, attributeValueCount: attributeValues.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Supabase persistence error";
    await client.from("dataset_versions").update({ status: "failed", validation_summary: { error: message } as Json }).eq("id", version.id);
    if (job) await client.from("source_jobs").update({ status: "failed", completed_at: new Date().toISOString(), error_summary: message }).eq("id", job.id);
    throw error;
  }
}
