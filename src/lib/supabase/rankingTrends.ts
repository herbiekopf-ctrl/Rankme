"use client";

import { getBrowserSupabaseClient, requirePermanentRankedUser } from "./browser";
import type { ResponseCadence } from "@/lib/domain/rankingPeriods";

export type TrendPlacement = {
  entityId: string;
  canonicalKey: string;
  name: string;
  imageUrl: string | null;
  color: string | null;
  position: number;
};

export type TrendSnapshot = {
  rankingId: string;
  cycleId: string | null;
  periodSlug: string;
  periodTitle: string;
  periodAt: string;
  publishedAt: string;
  placements: TrendPlacement[];
};

export type RankingTrendList = {
  templateVersionId: string;
  templateId: string;
  title: string;
  slug: string;
  entityType: string;
  responseCadence: ResponseCadence;
  maxLength: number;
  snapshots: TrendSnapshot[];
};

export type TrendEntity = Omit<TrendPlacement, "position">;

export function trendEntities(list: RankingTrendList): TrendEntity[] {
  const output = new Map<string, TrendEntity>();
  for (const snapshot of [...list.snapshots].reverse()) {
    for (const placement of snapshot.placements) {
      if (!output.has(placement.entityId)) {
        output.set(placement.entityId, {
          entityId: placement.entityId,
          canonicalKey: placement.canonicalKey,
          name: placement.name,
          imageUrl: placement.imageUrl,
          color: placement.color,
        });
      }
    }
  }
  return [...output.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function entityRankSeries(list: RankingTrendList, entityId: string): Array<number | null> {
  return list.snapshots.map((snapshot) => snapshot.placements.find((placement) => placement.entityId === entityId)?.position ?? null);
}

export async function loadMyRankingTrends(): Promise<RankingTrendList[]> {
  const client = getBrowserSupabaseClient();
  if (!client) return [];
  const user = await requirePermanentRankedUser(client);
  const { data: rankingRows, error: rankingError } = await client
    .from("rankings")
    .select("id,template_version_id,cycle_id,published_at")
    .eq("author_id", user.id)
    .eq("status", "published")
    .order("published_at", { ascending: true });
  if (rankingError) throw rankingError;
  if (!rankingRows.length) return [];

  const latestByPeriod = new Map<string, (typeof rankingRows)[number]>();
  for (const ranking of rankingRows) {
    const key = `${ranking.template_version_id}:${ranking.cycle_id ?? ranking.id}`;
    latestByPeriod.set(key, ranking);
  }
  const rankings = [...latestByPeriod.values()];
  const rankingIds = rankings.map((ranking) => ranking.id);
  const versionIds = [...new Set(rankings.map((ranking) => ranking.template_version_id))];
  const cycleIds = [...new Set(rankings.map((ranking) => ranking.cycle_id).filter((id): id is string => Boolean(id)))];

  const [versionResult, cycleResult, placementResult] = await Promise.all([
    client
      .from("ranking_template_versions")
      .select("id,template_id,default_length,response_cadence,ranking_templates(title,slug),entity_types(slug)")
      .in("id", versionIds),
    cycleIds.length
      ? client.from("ranking_cycles").select("id,slug,title,opens_at,closes_at").in("id", cycleIds)
      : Promise.resolve({ data: [], error: null }),
    client
      .from("ranking_placements")
      .select("ranking_id,position,entities(id,canonical_key,name,image_url,color)")
      .in("ranking_id", rankingIds)
      .order("position"),
  ]);
  if (versionResult.error) throw versionResult.error;
  if (cycleResult.error) throw cycleResult.error;
  if (placementResult.error) throw placementResult.error;

  const versionById = new Map(versionResult.data.map((version) => [version.id, version]));
  const cycleById = new Map((cycleResult.data ?? []).map((cycle) => [cycle.id, cycle]));
  const placementsByRanking = new Map<string, TrendPlacement[]>();
  for (const row of placementResult.data) {
    const entity = Array.isArray(row.entities) ? row.entities[0] : row.entities;
    if (!entity) continue;
    const placements = placementsByRanking.get(row.ranking_id) ?? [];
    placements.push({
      entityId: entity.id,
      canonicalKey: entity.canonical_key,
      name: entity.name,
      imageUrl: entity.image_url,
      color: entity.color,
      position: row.position,
    });
    placementsByRanking.set(row.ranking_id, placements);
  }

  const snapshotsByVersion = new Map<string, TrendSnapshot[]>();
  for (const ranking of rankings) {
    if (!ranking.published_at) continue;
    const cycle = ranking.cycle_id ? cycleById.get(ranking.cycle_id) : undefined;
    const snapshots = snapshotsByVersion.get(ranking.template_version_id) ?? [];
    snapshots.push({
      rankingId: ranking.id,
      cycleId: ranking.cycle_id,
      periodSlug: cycle?.slug ?? ranking.id,
      periodTitle: cycle?.title ?? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(ranking.published_at)),
      periodAt: cycle?.opens_at ?? ranking.published_at,
      publishedAt: ranking.published_at,
      placements: placementsByRanking.get(ranking.id) ?? [],
    });
    snapshotsByVersion.set(ranking.template_version_id, snapshots);
  }

  return versionIds.flatMap<RankingTrendList>((versionId) => {
    const version = versionById.get(versionId);
    if (!version) return [];
    const template = Array.isArray(version.ranking_templates) ? version.ranking_templates[0] : version.ranking_templates;
    const entityType = Array.isArray(version.entity_types) ? version.entity_types[0] : version.entity_types;
    const snapshots = (snapshotsByVersion.get(versionId) ?? []).sort((left, right) => left.periodAt.localeCompare(right.periodAt));
    if (!template || !entityType || !snapshots.length) return [];
    return [{
      templateVersionId: version.id,
      templateId: version.template_id,
      title: template.title,
      slug: template.slug,
      entityType: entityType.slug,
      responseCadence: version.response_cadence as ResponseCadence,
      maxLength: version.default_length,
      snapshots,
    }];
  }).sort((left, right) => (right.snapshots.at(-1)?.periodAt ?? "").localeCompare(left.snapshots.at(-1)?.periodAt ?? ""));
}
