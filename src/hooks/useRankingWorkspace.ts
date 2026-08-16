"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { encodeCustomPollConfig } from "@/lib/domain/customPolls";
import { emptyRankingHistory, rankingHistoryReducer } from "@/lib/domain/rankingHistory";
import { encodeRanking, insertEntity, moveEntity, removeEntity, validateRanking } from "@/lib/domain/ranking";
import type { CustomPollConfig, DatasetEnvelope, RankableEntity, RankingDraft, RankingTemplate } from "@/lib/domain/types";
import { calculateCustomMetricScores } from "@/lib/domain/metrics";
import { useCustomMetrics } from "./useCustomMetrics";
import { entityMatches } from "@/lib/utils";
import { persistBuiltInRankingDraft, persistCustomPoll, persistRankingDraft, publishPersistedRanking } from "@/lib/supabase/community";
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
  const [publishOpen, setPublishOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [rankedUser, setRankedUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [effectiveConfig, setEffectiveConfig] = useState(customConfig);
  const hydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    if (!hydrated.current) return;
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
          await persistRankingDraft(remoteConfig, dataset, history.present);
        } else {
          await persistBuiltInRankingDraft(template, dataset, history.present, 2026);
        }
      };
      void syncCloud().then(() => setSaveState("cloud")).catch(() => setSaveState("saved"));
    }, 350);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [dataset, effectiveConfig, history.past.length, history.present, rankedUser, storageKey, template]);

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

  const commit = useCallback((entityIds: string[]) => dispatch({ type: "commit", entityIds }), []);
  const addEntity = useCallback((entityId: string, position = history.present.length) => {
    commit(insertEntity(history.present, entityId, position, template.maxLength));
  }, [commit, history.present, template.maxLength]);
  const removeRankedEntity = useCallback((entityId: string) => {
    commit(removeEntity(history.present, entityId));
  }, [commit, history.present]);
  const moveRankedEntity = useCallback((entityId: string, toIndex: number) => {
    commit(moveEntity(history.present, entityId, toIndex));
  }, [commit, history.present]);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);

  const toggleCompare = useCallback((entityId: string) => {
    setCompareIds((current) => current.includes(entityId)
      ? current.filter((value) => value !== entityId)
      : [...current, entityId]);
    setAnalysisMode("compare");
    setMobileMode("analyze");
  }, []);

  const customQuery = effectiveConfig ? `&config=${encodeCustomPollConfig(effectiveConfig)}` : "";
  const sharePath = `/ballot/${customConfig ? "custom-poll" : "preseason-2026"}?template=${customConfig ? "custom" : template.id}&items=${encodeRanking(history.present)}${customQuery}`;

  const copyShareLink = useCallback(async () => {
    await navigator.clipboard.writeText(`${window.location.origin}${sharePath}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }, [sharePath]);

  const publishRanking = useCallback(async () => {
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
      setPublishError(reason instanceof Error ? reason.message : "The relational ballot could not be published.");
      setPublishing(false);
    }
  }, [dataset, effectiveConfig, history.present, router, sharePath, template]);

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
    publishOpen,
    setPublishOpen,
    copied,
    publishError,
    publishing,
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
