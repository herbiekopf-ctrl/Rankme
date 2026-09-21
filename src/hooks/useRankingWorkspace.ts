"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { encodeCustomPollConfig } from "@/lib/domain/customPolls";
import { emptyRankingHistory, rankingHistoryReducer } from "@/lib/domain/rankingHistory";
import { encodeRanking, insertEntity, moveEntity, removeEntity, validateRanking } from "@/lib/domain/ranking";
import type { CustomPollConfig, DatasetEnvelope, RankableEntity, RankingDraft, RankingTemplate } from "@/lib/domain/types";
import { collegeFootballSeason, periodIsOpen, defaultResponseCadence, localRankingPeriod, type RankingPeriodContext } from "@/lib/domain/rankingPeriods";
import { calculateCustomMetricScores } from "@/lib/domain/metrics";
import { useCustomMetrics } from "./useCustomMetrics";
import { entityMatches } from "@/lib/utils";
import { loadCurrentRankingPeriod, persistBuiltInRankingDraft, persistCustomPoll, persistRankingDraft, publishPersistedRanking } from "@/lib/supabase/community";
import { getBrowserSupabaseClient, getRankedUser, isPermanentRankedUser } from "@/lib/supabase/browser";
import type { User } from "@supabase/supabase-js";

export type AnalysisMode = "metric" | "metric-builder";
export type MobileWorkspaceMode = "ranking" | "analyze";

const PREFERRED_METRIC_KEYS = [
  "apRank",
  "strengthOfRecordRank",
  "fpi",
  "spOverall",
  "strengthOfSchedule",
  "winPct",
  "wins",
];

function initialMetricKey(dataset: DatasetEnvelope): string {
  const metrics = dataset.metricDefinitions ?? [];
  return PREFERRED_METRIC_KEYS.find((key) => metrics.some((metric) => metric.key === key))
    ?? metrics[0]?.key
    ?? "name";
}

function sameOrder(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function useRankingWorkspace({
  template,
  initialDataset,
  customConfig,
}: {
  template: RankingTemplate;
  initialDataset: DatasetEnvelope;
  customConfig?: CustomPollConfig;
}) {
  const router = useRouter();
  const dataset = initialDataset;
  const [history, dispatch] = useReducer(rankingHistoryReducer, emptyRankingHistory);
  const [query, setQuery] = useState("");
  const [conference, setConference] = useState("All");
  const [candidateSort, setCandidateSort] = useState(() => initialMetricKey(initialDataset));
  const [saveState, setSaveState] = useState<"loading" | "saving" | "saved" | "cloud" | "unsaved">("loading");
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("metric");
  const [mobileMode, setMobileMode] = useState<MobileWorkspaceMode>("ranking");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [focusedRankId, setFocusedRankId] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [rankedUser, setRankedUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [effectiveConfig, setEffectiveConfig] = useState(customConfig);
  const fallbackPeriod = useMemo(
    () => localRankingPeriod(defaultResponseCadence(template.id, effectiveConfig?.responseCadence), effectiveConfig?.year ?? collegeFootballSeason()),
    [effectiveConfig?.responseCadence, effectiveConfig?.year, template.id],
  );
  const [periodContext, setPeriodContext] = useState<RankingPeriodContext>(fallbackPeriod);
  const [periodReady, setPeriodReady] = useState(false);
  const [periodLoadError, setPeriodLoadError] = useState("");
  const [editingPublished, setEditingPublished] = useState(false);
  const hydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusTimer = useRef<number | null>(null);
  const storageKey = `ranked:draft:${rankedUser?.id ?? "guest"}:${template.id}:${fallbackPeriod.periodSlug}`;
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setClock(Date.now());
    const timer = window.setInterval(tick, 30_000);
    window.addEventListener("focus", tick);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", tick); };
  }, []);
  const customMetrics = useCustomMetrics(template.entityType, isPermanentRankedUser(rankedUser));

  useEffect(() => {
    const client = getBrowserSupabaseClient();
    if (!client) {
      Promise.resolve().then(() => setAuthReady(true));
      return;
    }
    let active = true;
    getRankedUser(client)
      .then((user) => { if (active) setRankedUser(user); })
      .catch(() => undefined)
      .finally(() => { if (active) setAuthReady(true); });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setRankedUser(session?.user ?? null);
      setAuthReady(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      if (!isPermanentRankedUser(rankedUser)) {
        setPeriodContext(fallbackPeriod);
        setPeriodLoadError("");
        setPeriodReady(true);
        return;
      }
      setPeriodReady(false);
      setPeriodLoadError("");
      try {
        const context = await loadCurrentRankingPeriod(template, effectiveConfig);
        if (!active) return;
        const next = context ?? fallbackPeriod;
        setPeriodContext(next);
        setEditingPublished(false);
        if (next.rankingId) {
          const available = new Set(dataset.entities.map((entity) => entity.id));
          const savedIds = next.entityIds.filter((id) => available.has(id));
          dispatch({ type: "hydrate", entityIds: savedIds, maxLength: template.maxLength });
          const draft: RankingDraft = {
            id: next.rankingId,
            templateId: template.id,
            templateVersion: template.version,
            datasetVersion: dataset.version,
            revision: 0,
            entityIds: savedIds,
            updatedAt: next.updatedAt ?? new Date().toISOString(),
          };
          window.localStorage.setItem(storageKey, JSON.stringify(draft));
          setSaveState("cloud");
        }
      } catch (reason) {
        if (!active) return;
        setPeriodContext(fallbackPeriod);
        setPeriodLoadError(reason instanceof Error ? reason.message : "Saved period status is unavailable.");
      } finally {
        if (active) setPeriodReady(true);
      }
    });
    return () => { active = false; };
  }, [authReady, dataset.entities, dataset.version, effectiveConfig, fallbackPeriod, rankedUser, storageKey, template]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      try {
        const guestKey = `ranked:draft:guest:${template.id}:${fallbackPeriod.periodSlug}`;
        const saved = window.localStorage.getItem(storageKey)
          ?? (rankedUser ? window.localStorage.getItem(guestKey) : null);
        const draft = saved ? JSON.parse(saved) as RankingDraft : null;
        const available = new Set(dataset.entities.map(entity => entity.id));
        const ids = draft?.templateId === template.id && Array.isArray(draft.entityIds)
          ? draft.entityIds.filter(id => available.has(id)) : [];
        dispatch({ type: "hydrate", entityIds: ids, maxLength: template.maxLength });
        setSaveState("saved");
      } catch {
        dispatch({ type: "hydrate", entityIds: [], maxLength: template.maxLength });
        setSaveState("unsaved");
      } finally {
        hydrated.current = true;
      }
    });
    return () => { active = false; };
  }, [storageKey, template.id, template.maxLength, dataset.entities, fallbackPeriod.periodSlug, rankedUser]);

  const periodOpensAt = periodContext.opensAt;
  const periodClosesAt = periodContext.closesAt;
  const periodEditable = periodContext.editable;
  const periodSeason = periodContext.season;
  const hasRemoteDraft = Boolean(periodContext.rankingId);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    const windowContext = { opensAt: periodOpensAt, closesAt: periodClosesAt, editable: periodEditable };
    if (!hydrated.current || !periodReady || periodContext.status === "published" || !periodIsOpen(windowContext)) return;
    let active = true;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (!periodIsOpen(windowContext)) return;
      const draft: RankingDraft = {
        id: `local-${template.id}`,
        templateId: template.id,
        templateVersion: template.version,
        datasetVersion: dataset.version,
        revision: history.past.length,
        entityIds: history.present,
        updatedAt: new Date().toISOString(),
      };
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(draft));
      } catch {
        setSaveState("unsaved");
        return;
      }
      if (!isPermanentRankedUser(rankedUser) || (history.present.length === 0 && !hasRemoteDraft) || periodLoadError) return setSaveState("saved");
      const syncCloud = async () => {
        if (!active || !periodIsOpen(windowContext)) return;
        let rankingId: string;
        if (effectiveConfig) {
          const remoteConfig = effectiveConfig.remoteTemplateVersionId ? effectiveConfig : await persistCustomPoll(effectiveConfig, dataset);
          if (remoteConfig !== effectiveConfig && active) {
            setEffectiveConfig(remoteConfig);
            window.localStorage.setItem(`ranked:custom-poll:${remoteConfig.id}`, JSON.stringify(remoteConfig));
          }
          if (!active || !periodIsOpen(windowContext)) return;
          rankingId = await persistRankingDraft(remoteConfig, dataset, history.present);
        } else {
          rankingId = await persistBuiltInRankingDraft(template, dataset, history.present, periodSeason);
        }
        if (active) setPeriodContext((current) => ({ ...current, rankingId, status: "draft", entityIds: history.present, updatedAt: new Date().toISOString() }));
      };
      saveQueue.current = saveQueue.current.catch(() => undefined).then(syncCloud);
      void saveQueue.current.then(() => { if (active) setSaveState("cloud"); }).catch(() => { if (active) setSaveState("saved"); });
    }, 350);
    return () => {
      active = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [dataset, effectiveConfig, history.past.length, history.present, periodContext.status, hasRemoteDraft, periodSeason, periodOpensAt, periodClosesAt, periodEditable, periodLoadError, periodReady, rankedUser, storageKey, template]);

  const hasPublishedChanges = editingPublished && !sameOrder(history.present, periodContext.entityIds);

  const entitiesById = useMemo(() => new Map(dataset.entities.map((entity) => [entity.id, entity])), [dataset.entities]);
  const rankedEntities = useMemo(
    () => history.present.map((id) => entitiesById.get(id)).filter((entity): entity is RankableEntity => Boolean(entity)),
    [entitiesById, history.present],
  );
  const rankedSet = useMemo(() => new Set(history.present), [history.present]);
  const conferences = useMemo(
    () => [...new Set(dataset.entities.map((entity) => String(entity.attributes.conference ?? "Other")))].sort(),
    [dataset.entities],
  );
  const hasConference = useMemo(() => dataset.entities.some((entity) => entity.attributes.conference), [dataset.entities]);
  const metricEntities = useMemo(() => {
    const options = dataset.entities.filter((entity) =>
      entityMatches(entity, query)
      && (conference === "All" || entity.attributes.conference === conference),
    );
    if (candidateSort === "name") return options.sort((a, b) => a.name.localeCompare(b.name));
    if (candidateSort.startsWith("custom:")) {
      const customMetric = customMetrics.metrics.find((metric) => `custom:${metric.id}` === candidateSort);
      if (!customMetric) return options;
      const scores = calculateCustomMetricScores(dataset.entities, dataset.metricDefinitions ?? [], customMetric.formula);
      return options.sort((a, b) => (scores.get(b.id) ?? -1) - (scores.get(a.id) ?? -1));
    }
    const metric = dataset.metricDefinitions?.find((definition) => definition.key === candidateSort);
    if (!metric) return options;
    return options.sort((a, b) => {
      const left = typeof a.attributes[candidateSort] === "number" ? a.attributes[candidateSort] as number : null;
      const right = typeof b.attributes[candidateSort] === "number" ? b.attributes[candidateSort] as number : null;
      if (left == null) return 1;
      if (right == null) return -1;
      return metric.direction === "asc" ? left - right : right - left;
    });
  }, [candidateSort, conference, customMetrics.metrics, dataset.entities, dataset.metricDefinitions, query]);

  const validationErrors = useMemo(() => validateRanking(template, history.present), [history.present, template]);
  const remaining = Math.max(0, template.defaultLength - history.present.length);
  const detailEntity = detailId ? entitiesById.get(detailId) : undefined;

  const canRevisePublished = periodReady && periodContext.status === "published" && periodIsOpen(periodContext, clock);
  const canEditPeriod = periodReady && periodIsOpen(periodContext, clock);
  const commit = useCallback((entityIds: string[]) => {
    if (!canEditPeriod) return;
    if (periodContext.status === "published" && !editingPublished) setEditingPublished(true);
    dispatch({ type: "commit", entityIds });
  }, [canEditPeriod, editingPublished, periodContext.status]);
  const addEntity = useCallback((entityId: string, position = history.present.length) => {
    commit(insertEntity(history.present, entityId, position, template.maxLength));
  }, [commit, history.present, template.maxLength]);
  const removeRankedEntity = useCallback((entityId: string) => {
    commit(removeEntity(history.present, entityId));
  }, [commit, history.present]);
  const moveRankedEntity = useCallback((entityId: string, toIndex: number) => {
    commit(moveEntity(history.present, entityId, toIndex));
  }, [commit, history.present]);
  const undo = useCallback(() => {
    if (!canEditPeriod) return;
    if (periodContext.status === "published" && !editingPublished) setEditingPublished(true);
    dispatch({ type: "undo" });
  }, [canEditPeriod, editingPublished, periodContext.status]);
  const redo = useCallback(() => {
    if (!canEditPeriod) return;
    if (periodContext.status === "published" && !editingPublished) setEditingPublished(true);
    dispatch({ type: "redo" });
  }, [canEditPeriod, editingPublished, periodContext.status]);

  const beginPublishedEdit = useCallback(() => {
    if (!canRevisePublished) return;
    setEditingPublished(true);
    setPublishError("");
  }, [canRevisePublished]);

  const cancelPublishedEdit = useCallback(() => {
    dispatch({ type: "hydrate", entityIds: periodContext.entityIds, maxLength: template.maxLength });
    setEditingPublished(false);
    setSaveState("cloud");
    setPublishError("");
  }, [periodContext.entityIds, template.maxLength]);

  const focusRankedEntity = useCallback((entityId: string) => {
    if (!rankedSet.has(entityId)) return;
    setMobileMode("ranking");
    setFocusedRankId(entityId);
    if (focusTimer.current) clearTimeout(focusTimer.current);
    window.setTimeout(() => {
      document.querySelector<HTMLElement>(`[data-ranked-entity-id="${CSS.escape(entityId)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 40);
    focusTimer.current = window.setTimeout(() => setFocusedRankId(null), 1800);
  }, [rankedSet]);

  useEffect(() => () => {
    if (focusTimer.current) clearTimeout(focusTimer.current);
  }, []);

  const customQuery = effectiveConfig ? `&config=${encodeCustomPollConfig(effectiveConfig)}` : "";
  const sharePath = `/ballot/${customConfig ? "custom-poll" : "preseason-2026"}?template=${customConfig ? "custom" : template.id}&items=${encodeRanking(history.present)}${customQuery}`;

  const copyShareLink = useCallback(async () => {
    await navigator.clipboard.writeText(`${window.location.origin}${sharePath}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }, [sharePath]);

  const publishRanking = useCallback(async () => {
    if (!canEditPeriod) return;
    setPublishing(true);
    setPublishError("");
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      await saveQueue.current.catch(() => undefined);
      if (!periodIsOpen(periodContext)) throw new Error("This voting week has closed. Reload to begin the new week.");
      const currentPeriod = await loadCurrentRankingPeriod(template, effectiveConfig);
      if (!currentPeriod || currentPeriod.periodSlug !== periodContext.periodSlug || !periodIsOpen(currentPeriod)) throw new Error("The voting period has changed. Reload before submitting.");
      let rankingId: string;
      if (effectiveConfig) {
        const remoteConfig = await persistCustomPoll(effectiveConfig, dataset);
        setEffectiveConfig(remoteConfig);
        window.localStorage.setItem(`ranked:custom-poll:${remoteConfig.id}`, JSON.stringify(remoteConfig));
        rankingId = await persistRankingDraft(remoteConfig, dataset, history.present);
      } else {
        rankingId = await persistBuiltInRankingDraft(template, dataset, history.present, periodContext.season);
      }
      if (periodContext.status === "published") {
        const savedAt = new Date().toISOString();
        setPeriodContext((current) => ({ ...current, rankingId, status: "published", entityIds: history.present, updatedAt: savedAt, publishedAt: savedAt }));
        setEditingPublished(false);
        setSaveState("cloud");
      } else {
        await publishPersistedRanking(rankingId);
      }
      router.push(sharePath);
    } catch (reason) {
      setPublishError(reason instanceof Error ? reason.message : "Your ranking could not be published.");
      setPublishing(false);
    }
  }, [canEditPeriod, dataset, effectiveConfig, history.present, periodContext, router, sharePath, template]);

  return {
    template,
    dataset,
    customConfig,
    history,
    rankedEntities,
    rankedSet,
    metricEntities,
    conferences,
    hasConference,
    query,
    setQuery,
    conference,
    setConference,
    candidateSort,
    setCandidateSort,
    saveState: hasPublishedChanges ? "unsaved" as const : saveState,
    analysisMode,
    setAnalysisMode,
    mobileMode,
    setMobileMode,
    detailEntity,
    setDetailId,
    focusedRankId,
    focusRankedEntity,
    publishOpen,
    setPublishOpen,
    copied,
    publishError,
    publishing,
    periodContext,
    periodReady,
    periodLoadError,
    editingPublished,
    hasPublishedChanges,
    canRevisePublished,
    isPeriodLocked: !canEditPeriod,
    sharePath,
    authReady,
    canPublishRelational: isPermanentRankedUser(rankedUser),
    rankedUser,
    customMetrics,
    validationErrors,
    remaining,
    commit,
    addEntity,
    removeRankedEntity,
    moveRankedEntity,
    undo,
    redo,
    beginPublishedEdit,
    cancelPublishedEdit,
    copyShareLink,
    publishRanking,
  };
}

export type RankingWorkspaceController = ReturnType<typeof useRankingWorkspace>;
