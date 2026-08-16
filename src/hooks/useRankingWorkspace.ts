"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { encodeCustomPollConfig } from "@/lib/domain/customPolls";
import { emptyRankingHistory, rankingHistoryReducer } from "@/lib/domain/rankingHistory";
import { encodeRanking, insertEntity, moveEntity, removeEntity, validateRanking } from "@/lib/domain/ranking";
import type { CustomPollConfig, DatasetEnvelope, RankableEntity, RankingDraft, RankingTemplate } from "@/lib/domain/types";
import { defaultResponseCadence, localRankingPeriod, type RankingPeriodContext } from "@/lib/domain/rankingPeriods";
import { calculateCustomMetricScores } from "@/lib/domain/metrics";
import { useCustomMetrics } from "./useCustomMetrics";
import { entityMatches } from "@/lib/utils";
import { loadCurrentRankingPeriod, persistBuiltInRankingDraft, persistCustomPoll, persistRankingDraft, publishPersistedRanking } from "@/lib/supabase/community";
import { getBrowserSupabaseClient, getRankedUser, isPermanentRankedUser } from "@/lib/supabase/browser";
import type { User } from "@supabase/supabase-js";

export type AnalysisMode = "candidates" | "compare" | "metric-builder";
export type MobileWorkspaceMode = "ranking" | "analyze";

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
  const [candidateSort, setCandidateSort] = useState("name");
  const [saveState, setSaveState] = useState<"loading" | "saving" | "saved" | "cloud">("loading");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("candidates");
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
    () => localRankingPeriod(defaultResponseCadence(template.id, effectiveConfig?.responseCadence), effectiveConfig?.year ?? 2026),
    [effectiveConfig?.responseCadence, effectiveConfig?.year, template.id],
  );
  const [periodContext, setPeriodContext] = useState<RankingPeriodContext>(fallbackPeriod);
  const [periodReady, setPeriodReady] = useState(false);
  const [periodLoadError, setPeriodLoadError] = useState("");
  const hydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusTimer = useRef<number | null>(null);
  const storageKey = `ranked:draft:${template.id}`;
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
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const draft = JSON.parse(saved) as RankingDraft;
        if (draft.templateId === template.id && Array.isArray(draft.entityIds)) {
          dispatch({ type: "hydrate", entityIds: draft.entityIds, maxLength: template.maxLength });
        }
      }
    } finally {
      hydrated.current = true;
      setSaveState("saved");
    }
  }, [storageKey, template.id, template.maxLength]);

  useEffect(() => {
    if (!hydrated.current || !periodReady || periodContext.status === "published") return;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const draft: RankingDraft = {
        id: `local-${template.id}`,
        templateId: template.id,
        templateVersion: template.version,
        datasetVersion: dataset.version,
        revision: history.past.length,
        entityIds: history.present,
        updatedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(storageKey, JSON.stringify(draft));
      if (!isPermanentRankedUser(rankedUser) || history.present.length === 0) return setSaveState("saved");
      const syncCloud = async () => {
        if (effectiveConfig) {
          const remoteConfig = effectiveConfig.remoteTemplateVersionId ? effectiveConfig : await persistCustomPoll(effectiveConfig, dataset);
          if (remoteConfig !== effectiveConfig) {
            setEffectiveConfig(remoteConfig);
            window.localStorage.setItem(`ranked:custom-poll:${remoteConfig.id}`, JSON.stringify(remoteConfig));
          }
          const rankingId = await persistRankingDraft(remoteConfig, dataset, history.present);
          setPeriodContext((current) => ({ ...current, rankingId, status: "draft", entityIds: history.present, updatedAt: new Date().toISOString() }));
        } else {
          const rankingId = await persistBuiltInRankingDraft(template, dataset, history.present, 2026);
          setPeriodContext((current) => ({ ...current, rankingId, status: "draft", entityIds: history.present, updatedAt: new Date().toISOString() }));
        }
      };
      void syncCloud().then(() => setSaveState("cloud")).catch(() => setSaveState("saved"));
    }, 350);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [dataset, effectiveConfig, history.past.length, history.present, periodContext.status, periodReady, rankedUser, storageKey, template]);

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
  const candidates = useMemo(() => {
    const options = dataset.entities.filter((entity) =>
      !rankedSet.has(entity.id)
      && entityMatches(entity, query)
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
  }, [candidateSort, conference, customMetrics.metrics, dataset.entities, dataset.metricDefinitions, query, rankedSet]);

  const validationErrors = useMemo(() => validateRanking(template, history.present), [history.present, template]);
  const remaining = Math.max(0, template.defaultLength - history.present.length);
  const detailEntity = detailId ? entitiesById.get(detailId) : undefined;

  const canEditPeriod = periodReady && periodContext.status !== "published";
  const commit = useCallback((entityIds: string[]) => {
    if (canEditPeriod) dispatch({ type: "commit", entityIds });
  }, [canEditPeriod]);
  const addEntity = useCallback((entityId: string, position = history.present.length) => {
    commit(insertEntity(history.present, entityId, position, template.maxLength));
  }, [commit, history.present, template.maxLength]);
  const removeRankedEntity = useCallback((entityId: string) => {
    commit(removeEntity(history.present, entityId));
  }, [commit, history.present]);
  const moveRankedEntity = useCallback((entityId: string, toIndex: number) => {
    commit(moveEntity(history.present, entityId, toIndex));
  }, [commit, history.present]);
  const undo = useCallback(() => { if (canEditPeriod) dispatch({ type: "undo" }); }, [canEditPeriod]);
  const redo = useCallback(() => { if (canEditPeriod) dispatch({ type: "redo" }); }, [canEditPeriod]);

  const toggleCompare = useCallback((entityId: string) => {
    setCompareIds((current) => current.includes(entityId)
      ? current.filter((value) => value !== entityId)
      : [...current, entityId]);
    setAnalysisMode("compare");
    setMobileMode("analyze");
  }, []);

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
      let rankingId: string;
      if (effectiveConfig) {
        const remoteConfig = await persistCustomPoll(effectiveConfig, dataset);
        setEffectiveConfig(remoteConfig);
        window.localStorage.setItem(`ranked:custom-poll:${remoteConfig.id}`, JSON.stringify(remoteConfig));
        rankingId = await persistRankingDraft(remoteConfig, dataset, history.present);
      } else {
        rankingId = await persistBuiltInRankingDraft(template, dataset, history.present, 2026);
      }
      await publishPersistedRanking(rankingId);
      router.push(sharePath);
    } catch (reason) {
      setPublishError(reason instanceof Error ? reason.message : "Your ranking could not be published.");
      setPublishing(false);
    }
  }, [canEditPeriod, dataset, effectiveConfig, history.present, router, sharePath, template]);

  return {
    template,
    dataset,
    customConfig,
    history,
    rankedEntities,
    rankedSet,
    candidates,
    conferences,
    hasConference,
    query,
    setQuery,
    conference,
    setConference,
    candidateSort,
    setCandidateSort,
    saveState,
    compareIds,
    setCompareIds,
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
    toggleCompare,
    copyShareLink,
    publishRanking,
  };
}

export type RankingWorkspaceController = ReturnType<typeof useRankingWorkspace>;
