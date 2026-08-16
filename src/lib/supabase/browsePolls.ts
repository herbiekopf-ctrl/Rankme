"use client";

import { getBrowserSupabaseClient } from "./browser";

export type BrowsePollPreview = {
  position: number;
  canonicalKey: string;
  name: string;
  imageUrl: string | null;
  color: string | null;
};

export type BrowsePoll = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  templateKind: string;
  entityType: string;
  length: number;
  createdAt: string;
  lastResponseAt: string | null;
  responseCount: number;
  preview: BrowsePollPreview[];
};

export function browsePollHref(poll: Pick<BrowsePoll, "id" | "slug" | "templateKind">): string {
  if (poll.templateKind === "official" && poll.slug.startsWith("official-")) {
    return `/rank/${poll.slug.slice("official-".length)}`;
  }
  return `/rank/custom/${poll.id}`;
}

export function recentPolls(polls: BrowsePoll[]): BrowsePoll[] {
  return [...polls].sort((left, right) => {
    const leftDate = left.lastResponseAt ?? left.createdAt;
    const rightDate = right.lastResponseAt ?? right.createdAt;
    return rightDate.localeCompare(leftDate);
  });
}

export function popularPolls(polls: BrowsePoll[]): BrowsePoll[] {
  return [...polls].sort((left, right) => right.responseCount - left.responseCount || (right.lastResponseAt ?? right.createdAt).localeCompare(left.lastResponseAt ?? left.createdAt));
}

export async function loadBrowsePolls(): Promise<BrowsePoll[]> {
  const client = getBrowserSupabaseClient();
  if (!client) throw new Error("Browse is not connected.");

  const { data: templates, error: templateError } = await client
    .from("ranking_templates")
    .select("id,slug,title,description,template_kind,created_at")
    .eq("status", "active")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(50);
  if (templateError) throw templateError;
  if (!templates.length) return [];

  const templateIds = templates.map((template) => template.id);
  const { data: versions, error: versionError } = await client
    .from("ranking_template_versions")
    .select("id,template_id,entity_type_id,default_length,version")
    .in("template_id", templateIds)
    .order("version", { ascending: false });
  if (versionError) throw versionError;

  const latestVersionByTemplate = new Map<string, (typeof versions)[number]>();
  for (const version of versions) {
    if (!latestVersionByTemplate.has(version.template_id)) latestVersionByTemplate.set(version.template_id, version);
  }
  const latestVersions = [...latestVersionByTemplate.values()];
  const entityTypeIds = [...new Set(latestVersions.map((version) => version.entity_type_id))];
  const { data: entityTypes, error: entityTypeError } = await client.from("entity_types").select("id,slug").in("id", entityTypeIds);
  if (entityTypeError) throw entityTypeError;
  const entityTypeById = new Map(entityTypes.map((entityType) => [entityType.id, entityType.slug]));

  const versionIds = latestVersions.map((version) => version.id);
  const { data: rankings, error: rankingError } = await client
    .from("rankings")
    .select("id,template_version_id,published_at")
    .in("template_version_id", versionIds)
    .eq("status", "published")
    .eq("visibility", "public")
    .order("published_at", { ascending: false });
  if (rankingError) throw rankingError;

  const responseCountByVersion = new Map<string, number>();
  const latestRankingByVersion = new Map<string, { id: string; publishedAt: string | null }>();
  for (const ranking of rankings) {
    responseCountByVersion.set(ranking.template_version_id, (responseCountByVersion.get(ranking.template_version_id) ?? 0) + 1);
    if (!latestRankingByVersion.has(ranking.template_version_id)) {
      latestRankingByVersion.set(ranking.template_version_id, { id: ranking.id, publishedAt: ranking.published_at });
    }
  }

  const latestRankingIds = [...latestRankingByVersion.values()].map((ranking) => ranking.id);
  const previewByRanking = new Map<string, BrowsePollPreview[]>();
  if (latestRankingIds.length) {
    const { data: placements, error: placementError } = await client
      .from("ranking_placements")
      .select("ranking_id,position,entities(canonical_key,name,image_url,color)")
      .in("ranking_id", latestRankingIds)
      .lte("position", 3)
      .order("position");
    if (placementError) throw placementError;
    for (const placement of placements) {
      const entity = Array.isArray(placement.entities) ? placement.entities[0] : placement.entities;
      if (!entity) continue;
      const preview = previewByRanking.get(placement.ranking_id) ?? [];
      preview.push({
        position: placement.position,
        canonicalKey: entity.canonical_key,
        name: entity.name,
        imageUrl: entity.image_url,
        color: entity.color,
      });
      previewByRanking.set(placement.ranking_id, preview);
    }
  }

  return templates.flatMap<BrowsePoll>((template) => {
    const version = latestVersionByTemplate.get(template.id);
    if (!version) return [];
    const latestRanking = latestRankingByVersion.get(version.id);
    return [{
      id: template.id,
      slug: template.slug,
      title: template.title,
      description: template.description,
      templateKind: template.template_kind,
      entityType: entityTypeById.get(version.entity_type_id) ?? "item",
      length: version.default_length,
      createdAt: template.created_at,
      lastResponseAt: latestRanking?.publishedAt ?? null,
      responseCount: responseCountByVersion.get(version.id) ?? 0,
      preview: latestRanking ? previewByRanking.get(latestRanking.id) ?? [] : [],
    }];
  });
}
