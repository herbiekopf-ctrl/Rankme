"use client";

import { getBrowserSupabaseClient, getRankedUser, isPermanentRankedUser } from "./browser";
import { localRankingPeriod, type RankingResponseStatus, type ResponseCadence } from "@/lib/domain/rankingPeriods";

export type BrowsePollPreview = {
  position: number;
  canonicalKey: string;
  name: string;
  imageUrl: string | null;
  color: string | null;
  points: number;
  averagePosition: number;
  ballotCount: number;
};

export type BrowseDemographicFilter = {
  id: string;
  label: string;
  group: string;
  imageUrl: string | null;
  color: string | null;
  entityType: "team" | "conference" | null;
};

export type BrowsePoll = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  templateKind: string;
  templateVersionId: string;
  cycleId: string | null;
  entityType: string;
  length: number;
  createdAt: string;
  lastResponseAt: string | null;
  responseCount: number;
  selectedResponseCount: number | null;
  consensusSuppressed: boolean;
  minimumCohort: number;
  responseCadence: ResponseCadence;
  periodTitle: string;
  myResponseStatus: RankingResponseStatus;
  preview: BrowsePollPreview[];
};

type BrowseConsensusResult = {
  templateVersionId: string;
  cycleId: string;
  totalVoterCount: number;
  selectedVoterCount: number | null;
  lastResponseAt: string | null;
  suppressed: boolean;
  minimumCohort: number;
  positions: BrowsePollPreview[];
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

export function participatedPolls(polls: BrowsePoll[]): BrowsePoll[] {
  return recentPolls(polls.filter((poll) => poll.myResponseStatus !== null));
}

function parseConsensusResult(value: unknown): BrowseConsensusResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.templateVersionId !== "string" || typeof row.cycleId !== "string") return null;
  const positions = Array.isArray(row.positions) ? row.positions.flatMap<BrowsePollPreview>((position) => {
    if (!position || typeof position !== "object" || Array.isArray(position)) return [];
    const item = position as Record<string, unknown>;
    if (typeof item.canonicalKey !== "string" || typeof item.name !== "string" || typeof item.position !== "number") return [];
    return [{
      position: item.position,
      canonicalKey: item.canonicalKey,
      name: item.name,
      imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : null,
      color: typeof item.color === "string" ? item.color : null,
      points: typeof item.points === "number" ? item.points : 0,
      averagePosition: typeof item.averagePosition === "number" ? item.averagePosition : 0,
      ballotCount: typeof item.ballotCount === "number" ? item.ballotCount : 0,
    }];
  }) : [];
  return {
    templateVersionId: row.templateVersionId,
    cycleId: row.cycleId,
    totalVoterCount: typeof row.totalVoterCount === "number" ? row.totalVoterCount : 0,
    selectedVoterCount: typeof row.selectedVoterCount === "number" ? row.selectedVoterCount : null,
    lastResponseAt: typeof row.lastResponseAt === "string" ? row.lastResponseAt : null,
    suppressed: row.suppressed === true,
    minimumCohort: typeof row.minimumCohort === "number" ? row.minimumCohort : 5,
    positions,
  };
}

async function loadConsensus(
  targets: Array<{ templateVersionId: string; cycleId: string }>,
  filterIds: string[],
): Promise<Map<string, BrowseConsensusResult>> {
  if (!targets.length) return new Map();
  const client = getBrowserSupabaseClient();
  const headers = new Headers({ "Content-Type": "application/json" });
  if (filterIds.length && client) {
    const { data } = await client.auth.getSession();
    if (data.session?.access_token) headers.set("Authorization", `Bearer ${data.session.access_token}`);
  }
  const response = await fetch("/api/consensus/browse", {
    method: "POST",
    headers,
    body: JSON.stringify({ targets, filterIds }),
  });
  if (!response.ok) throw new Error("Community consensus could not be loaded.");
  const body = await response.json() as { results?: unknown[] };
  const results = (body.results ?? []).map(parseConsensusResult).filter((result): result is BrowseConsensusResult => Boolean(result));
  return new Map(results.map((result) => [result.templateVersionId, result]));
}

export async function loadBrowseProfileFilters(): Promise<BrowseDemographicFilter[]> {
  const client = getBrowserSupabaseClient();
  if (!client) return [];
  const user = await getRankedUser(client).catch(() => null);
  if (!isPermanentRankedUser(user)) return [];

  const [affiliationResult, selectionResult] = await Promise.all([
    client
      .from("user_entity_affiliations")
      .select("entity_id,affiliation_type")
      .eq("user_id", user.id)
      .in("affiliation_type", ["favorite", "conference_fan"]),
    client.from("user_cohort_values").select("cohort_value_id").eq("user_id", user.id),
  ]);
  if (affiliationResult.error) throw affiliationResult.error;
  if (selectionResult.error) throw selectionResult.error;

  const affiliationEntityIds = (affiliationResult.data ?? []).map((row) => row.entity_id);
  const cohortValueIds = (selectionResult.data ?? []).map((row) => row.cohort_value_id);
  const [entityResult, valueResult] = await Promise.all([
    affiliationEntityIds.length
      ? client.from("entities").select("id,name,image_url,color,entity_types!inner(slug)").in("id", affiliationEntityIds)
      : Promise.resolve({ data: [], error: null }),
    cohortValueIds.length
      ? client.from("cohort_values").select("id,dimension_id,label,slug").in("id", cohortValueIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (entityResult.error) throw entityResult.error;
  if (valueResult.error) throw valueResult.error;
  const dimensionIds = [...new Set((valueResult.data ?? []).map((value) => value.dimension_id))];
  const { data: dimensions, error: dimensionError } = dimensionIds.length
    ? await client.from("cohort_dimensions").select("id,name,slug,sensitive").in("id", dimensionIds).eq("status", "active")
    : { data: [], error: null };
  if (dimensionError) throw dimensionError;

  const entityById = new Map((entityResult.data ?? []).map((entity) => [entity.id, entity]));
  const dimensionById = new Map((dimensions ?? []).map((dimension) => [dimension.id, dimension]));
  const filters: BrowseDemographicFilter[] = [];
  for (const affiliation of affiliationResult.data ?? []) {
    const entity = entityById.get(affiliation.entity_id);
    const entityType = Array.isArray(entity?.entity_types) ? entity?.entity_types[0] : entity?.entity_types;
    if (!entity || (entityType?.slug !== "team" && entityType?.slug !== "conference")) continue;
    filters.push({
      id: affiliation.affiliation_type === "favorite" ? "favorite" : "conference_fan",
      label: `${entity.name} fans`,
      group: affiliation.affiliation_type === "favorite" ? "Favorite team" : "Conference",
      imageUrl: entity.image_url,
      color: entity.color,
      entityType: entityType.slug,
    });
  }
  for (const value of valueResult.data ?? []) {
    const dimension = dimensionById.get(value.dimension_id);
    if (!dimension) continue;
    filters.push({
      id: `cohort:${value.id}`,
      label: value.label,
      group: dimension.name,
      imageUrl: null,
      color: null,
      entityType: null,
    });
  }
  return filters;
}

export async function loadBrowsePolls(filterIds: string[] = []): Promise<BrowsePoll[]> {
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
    .select("id,template_id,entity_type_id,default_length,version,response_cadence")
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
  const [cycleResult, rankedUser] = await Promise.all([
    client
      .from("ranking_cycles")
      .select("id,template_id,slug,title,opens_at,closes_at,status")
      .in("template_id", templateIds)
      .order("opens_at", { ascending: false, nullsFirst: false })
      .limit(250),
    getRankedUser(client).catch(() => null),
  ]);
  if (cycleResult.error) throw cycleResult.error;

  const cyclesData = cycleResult.data ?? [];
  const periodByVersion = new Map<string, { title: string; cycleId: string | null }>();
  const now = Date.now();
  for (const version of latestVersions) {
    const cadence = version.response_cadence as ResponseCadence;
    const fallback = localRankingPeriod(cadence, 2026);
    const cycles = cyclesData.filter((cycle) => cycle.template_id === version.template_id);
    const current = cycles.find((cycle) => {
      if (cycle.slug === fallback.periodSlug) return true;
      if (cadence === "once") return cycle.slug === "single-response";
      if (cadence === "seasonal") return cycle.slug === "2026-season";
      return Boolean(cycle.opens_at && cycle.closes_at && new Date(cycle.opens_at).getTime() <= now && now < new Date(cycle.closes_at).getTime());
    });
    periodByVersion.set(version.id, { title: current?.title ?? fallback.periodTitle, cycleId: current?.id ?? null });
  }

  const myStatusByVersion = new Map<string, RankingResponseStatus>();
  if (isPermanentRankedUser(rankedUser)) {
    const { data: myRankings, error: myRankingError } = await client
      .from("rankings")
      .select("template_version_id,cycle_id,status,updated_at")
      .eq("author_id", rankedUser.id)
      .in("template_version_id", versionIds)
      .in("status", ["draft", "published"])
      .order("updated_at", { ascending: false });
    if (myRankingError) throw myRankingError;
    for (const ranking of myRankings) {
      const period = periodByVersion.get(ranking.template_version_id);
      if (period?.cycleId === ranking.cycle_id && !myStatusByVersion.has(ranking.template_version_id)) {
        myStatusByVersion.set(ranking.template_version_id, ranking.status as Exclude<RankingResponseStatus, null>);
      }
    }
  }

  const consensusByVersion = await loadConsensus(
    latestVersions.flatMap((version) => {
      const cycleId = periodByVersion.get(version.id)?.cycleId;
      return cycleId ? [{ templateVersionId: version.id, cycleId }] : [];
    }),
    filterIds,
  );

  return templates.flatMap<BrowsePoll>((template) => {
    const version = latestVersionByTemplate.get(template.id);
    if (!version) return [];
    const period = periodByVersion.get(version.id);
    const consensus = consensusByVersion.get(version.id);
    return [{
      id: template.id,
      slug: template.slug,
      title: template.title,
      description: template.description,
      templateKind: template.template_kind,
      templateVersionId: version.id,
      cycleId: period?.cycleId ?? null,
      entityType: entityTypeById.get(version.entity_type_id) ?? "item",
      length: version.default_length,
      createdAt: template.created_at,
      lastResponseAt: consensus?.lastResponseAt ?? null,
      responseCount: consensus?.totalVoterCount ?? 0,
      selectedResponseCount: consensus?.selectedVoterCount ?? (filterIds.length ? null : 0),
      consensusSuppressed: consensus?.suppressed ?? false,
      minimumCohort: consensus?.minimumCohort ?? (filterIds.length ? 5 : 1),
      responseCadence: version.response_cadence as ResponseCadence,
      periodTitle: period?.title ?? localRankingPeriod(version.response_cadence as ResponseCadence, 2026).periodTitle,
      myResponseStatus: myStatusByVersion.get(version.id) ?? null,
      preview: consensus?.positions ?? [],
    }];
  });
}
