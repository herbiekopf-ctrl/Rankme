"use client";

import { useCallback, useEffect, useState } from "react";
import type { CustomMetricFormula, UserCustomMetric } from "@/lib/domain/types";
import { deleteMyCustomMetric, loadMyCustomMetrics, saveMyCustomMetric } from "@/lib/supabase/customMetrics";

export function useCustomMetrics(entityType: string, enabled: boolean) {
  const [metrics, setMetrics] = useState<UserCustomMetric[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!enabled) { setMetrics([]); setLoading(false); return; }
    setLoading(true);
    try { setMetrics(await loadMyCustomMetrics(entityType)); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load your metrics."); }
    finally { setLoading(false); }
  }, [enabled, entityType]);

  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);

  const save = useCallback(async (name: string, formula: CustomMetricFormula, id?: string) => {
    const saved = await saveMyCustomMetric({ id, name, entityType, formula });
    setMetrics((current) => [saved, ...current.filter((metric) => metric.id !== saved.id)]);
    return saved;
  }, [entityType]);

  const remove = useCallback(async (id: string) => {
    await deleteMyCustomMetric(id);
    setMetrics((current) => current.filter((metric) => metric.id !== id));
  }, []);

  return { metrics, loading, error, refresh, save, remove };
}
