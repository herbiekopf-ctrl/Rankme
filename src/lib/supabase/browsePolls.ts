"use client";

import { getBrowserSupabaseClient, getRankedUser, isPermanentRankedUser, requirePermanentRankedUser } from "./browser";
import { localRankingPeriod, type RankingResponseStatus, type ResponseCadence } from "@/lib/domain/rankingPeriods";

export type BrowsePollPreview = {
  position: number;
  entityId: string;
  canonicalKey: string;
  name: string;
  imageUrl: string | null;
  color: string | null;
  points: number;
  averagePosition: number;
  ballotCount: number;
};

export type BrowseDemographicFilterOption = {
  id: string;
  label: string;
  imageUrl: string | null;
  color: string | null;
  entityType: "team" | "conference" | null;
};

export type BrowseDemographicFilterCategory = {
  id: string;
  label: string;
  options: BrowseDemographicFilterOption[];
};

export type BrowseConsensusPeriod = {
  cycleId: string;
  title: string;
  week: number | null;
  opensAt: string | null;
  responseCount: number;
  selectedResponseCount: number | null;
  suppressed: boolean;
  positions: BrowsePollPreview[];
};

export type BrowsePoll = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  creatorName: string;
  templateKind: string;
  templateVersionId: string;
  cycleId: string | null;
  entityType: string;
  length: number;
  maxLength: number;
  datasetVersionId: string | null;
  editable: boolean;
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
  history: BrowseConsensusPeriod[];
};

export type BrowseRankingEditorState = {
  rankingId: string | null;
  datasetVersionId: string;
  status: "draft" | "published" | null;
  visibility: string;
  title: string;
  note: string;
  entityIds: string[];
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

export function isPrimaryTop25(poll: Pick<BrowsePoll, "slug" | "templateKind" | "entityType" | "length">): boolean {
  return poll.slug === "official-top-25"
    || (poll.templateKind === "official" && poll.entityType === "team" && poll.length === 25);
}

export function displayRankingPeriod(title: string): string {
  const weekOf = title.match(/week of\s+(.+)$/i)?.[1];
  if (weekOf) return `Week of ${weekOf}`;
  return title.replace(/^\d{4}\s+response\s+/i, "");
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
    if (typeof item.entityId !== "string" || typeof item.canonicalKey !== "string" || typeof item.name !== "string" || typeof item.position !== "number") return [];
    return [{
      position: item.position,
      entityId: item.entityId,
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
  return new Map(results.map((result) => [`${result.templateVersionId}:${result.cycleId}`, result]));
}

export async function loadBrowseProfileFilters(): Promise<BrowseDemographicFilterCategory[]> {
  const client = getBrowserSupabaseClient();
  if (!client) return [];
  const user = await getRankedUser(client).catch(() => null);
  if (!isPermanentRankedUser(user)) return [];
  const { data } = await client.auth.getSession();
  if (!data.session?.access_token) return [];
  const response = await fetch("/api/consensus/filters", { headers: { Authorization: `Bearer ${data.session.access_token}` } });
  if (!response.ok) throw new Error("Demographic filters could not be loaded.");
  const body = await response.json() as { categories?: BrowseDemographicFilterCategory[] };
  return Array.isArray(body.categories) ? body.categories : [];
}

export async function loadBrowsePolls(filterIds: string[] = []): Promise<BrowsePoll[]> {
  const client = getBrowserSupabaseClient();
  if (!client) throw new Error("Browse is not connected.");

  const { data: templates, error: templateError } = await client
    .from("ranking_templates")
    .select("id,slug,title,description,template_kind,created_at,created_by")
    .eq("status", "active")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(50);
  if (templateError) throw templateError;
  if (!templates.length) return [];

  const templateIds = templates.map((template) => template.id);
  const { data: versions, error: versionError } = await client
    .from("ranking_template_versions")
    .select("id,template_id,entity_type_id,default_length,max_length,version,response_cadence")
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
  const creatorIds = [...new Set(templates.map((template) => template.created_by).filter((id): id is string => Boolean(id)))];
  const [cycleResult, rankedUser, creatorResult] = await Promise.all([
    client
      .from("ranking_cycles")
      .select("id,template_id,slug,title,opens_at,closes_at,status,season,week")
      .in("template_id", templateIds)
      .order("opens_at", { ascending: false, nullsFirst: false })
      .limit(250),
    getRankedUser(client).catch(() => null),
    creatorIds.length
      ? client.from("profiles").select("id,display_name,handle").in("id", creatorIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (cycleResult.error) throw cycleResult.error;
  if (creatorResult.error) throw creatorResult.error;

  const cyclesData = cycleResult.data ?? [];
  const periodByVersion = new Map<string, { title: string; cycleId: string | null; season: number; week: number | null; opensAt: string | null; editable: boolean }>();
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
    const editable = Boolean(current
      && current.status === "open"
      && (!current.opens_at || new Date(current.opens_at).getTime() <= now)
      && (!current.closes_at || now < new Date(current.closes_at).getTime()));
    periodByVersion.set(version.id, { title: current?.title ?? fallback.periodTitle, cycleId: current?.id ?? null, season: current?.season ?? 2026, week: current?.week ?? null, opensAt: current?.opens_at ?? null, editable });
  }

  const seasons = [...new Set([...periodByVersion.values()].map((period) => period.season))];
  const { data: collegeFootballDataset, error: datasetError } = await client.from("datasets").select("id").eq("slug", "cfbd-season").maybeSingle();
  if (datasetError) throw datasetError;
  const datasetVersionsResult = collegeFootballDataset?.id && seasons.length
    ? await client.from("dataset_versions").select("id,season,published_at").eq("dataset_id", collegeFootballDataset.id).in("season", seasons).in("status", ["published", "superseded"]).order("published_at", { ascending: false })
    : { data: [], error: null };
  if (datasetVersionsResult.error) throw datasetVersionsResult.error;
  const datasetVersionBySeason = new Map<number, string>();
  for (const datasetVersion of datasetVersionsResult.data ?? []) {
    if (datasetVersion.season != null && !datasetVersionBySeason.has(datasetVersion.season)) datasetVersionBySeason.set(datasetVersion.season, datasetVersion.id);
  }
  const creatorById = new Map((creatorResult.data ?? []).map((creator) => [creator.id, creator.display_name || (creator.handle ? `@${creator.handle}` : "Ranked member")]));

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

  const currentTargets = latestVersions.flatMap((version) => {
      const cycleId = periodByVersion.get(version.id)?.cycleId;
      return cycleId ? [{ templateVersionId: version.id, cycleId }] : [];
    });
  const top25Template = templates.find((template) => template.slug === "official-top-25");
  const top25Version = top25Template ? latestVersionByTemplate.get(top25Template.id) : undefined;
  const top25CycleId = top25Version ? periodByVersion.get(top25Version.id)?.cycleId : null;
  const top25Cycles = top25Template
    ? cyclesData
        .filter((cycle) => cycle.template_id === top25Template.id && (cycle.id === top25CycleId || !cycle.opens_at || new Date(cycle.opens_at).getTime() <= now))
        .sort((left, right) => String(right.opens_at ?? "").localeCompare(String(left.opens_at ?? "")))
        .slice(0, 3)
        .reverse()
    : [];
  const historyTargets = top25Version
    ? top25Cycles.map((cycle) => ({ templateVersionId: top25Version.id, cycleId: cycle.id }))
    : [];
  const [consensusByTarget, historyByTarget] = await Promise.all([
    loadConsensus(currentTargets, filterIds),
    loadConsensus(historyTargets, filterIds),
  ]);

  return templates.flatMap<BrowsePoll>((template) => {
    const version = latestVersionByTemplate.get(template.id);
    if (!version) return [];
    const period = periodByVersion.get(version.id);
    const consensus = period?.cycleId ? consensusByTarget.get(`${version.id}:${period.cycleId}`) : undefined;
    const history = top25Version?.id === version.id
      ? top25Cycles.map((cycle): BrowseConsensusPeriod => {
          const result = historyByTarget.get(`${version.id}:${cycle.id}`);
          return {
            cycleId: cycle.id,
            title: cycle.title,
            week: cycle.week,
            opensAt: cycle.opens_at,
            responseCount: result?.totalVoterCount ?? 0,
            selectedResponseCount: result?.selectedVoterCount ?? (filterIds.length ? null : 0),
            suppressed: result?.suppressed ?? false,
            positions: result?.positions ?? [],
          };
        })
      : [];
    return [{
      id: template.id,
      slug: template.slug,
      title: template.title,
      description: template.description,
      creatorName: template.template_kind === "official" ? "Ranked" : template.created_by ? creatorById.get(template.created_by) ?? "Ranked member" : "Ranked",
      templateKind: template.template_kind,
      templateVersionId: version.id,
      cycleId: period?.cycleId ?? null,
      entityType: entityTypeById.get(version.entity_type_id) ?? "item",
      length: version.default_length,
      maxLength: version.max_length,
      datasetVersionId: datasetVersionBySeason.get(period?.season ?? 2026) ?? null,
      editable: period?.editable ?? false,
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
      history,
    }];
  });
}

export async function loadBrowseRankingEditors(polls: BrowsePoll[]): Promise<Map<string, BrowseRankingEditorState>> {
  const client = getBrowserSupabaseClient();
  if (!client || !polls.length) return new Map();
  const user = await getRankedUser(client).catch(() => null);
  if (!isPermanentRankedUser(user)) return new Map();
  const versionIds = [...new Set(polls.map((poll) => poll.templateVersionId))];
  const { data, error } = await client
    .from("rankings")
    .select("id,template_version_id,cycle_id,dataset_version_id,status,visibility,title,note,ranking_placements(entity_id,position)")
    .eq("author_id", user.id)
    .in("template_version_id", versionIds)
    .in("status", ["draft", "published"])
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const rankingByPeriod = new Map<string, (NonNullable<typeof data>)[number]>();
  for (const ranking of data ?? []) {
    const key = `${ranking.template_version_id}:${ranking.cycle_id}`;
    if (!rankingByPeriod.has(key)) rankingByPeriod.set(key, ranking);
  }
  return new Map(polls.flatMap((poll) => {
    if (!poll.datasetVersionId) return [];
    const ranking = rankingByPeriod.get(`${poll.templateVersionId}:${poll.cycleId}`);
    const placements = ranking?.ranking_placements ?? [];
    return [[poll.templateVersionId, {
      rankingId: ranking?.id ?? null,
      datasetVersionId: ranking?.dataset_version_id ?? poll.datasetVersionId,
      status: ranking?.status === "published" ? "published" : ranking?.status === "draft" ? "draft" : null,
      visibility: ranking?.visibility ?? "public",
      title: ranking?.title ?? poll.title,
      note: ranking?.note ?? poll.description ?? "",
      entityIds: [...placements].sort((left, right) => left.position - right.position).map((placement) => placement.entity_id),
    } satisfies BrowseRankingEditorState]];
  }));
}

export async function saveBrowseRankingOrder(poll: BrowsePoll, state: BrowseRankingEditorState, entityIds: string[]): Promise<BrowseRankingEditorState> {
  const client = getBrowserSupabaseClient();
  if (!client) throw new Error("Saving is unavailable right now.");
  await requirePermanentRankedUser(client);
  const { data, error } = await client.rpc("save_my_ranking_draft", {
    p_template_version_id: poll.templateVersionId,
    p_dataset_version_id: state.datasetVersionId,
    p_title: state.title,
    p_note: state.note,
    p_visibility: state.visibility,
    p_entity_ids: entityIds,
    p_existing_ranking_id: state.rankingId ?? undefined,
  });
  if (error) throw error;
  return { ...state, rankingId: data, status: state.status ?? "draft", entityIds };
}
