"use client";

import { useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient, requirePermanentRankedUser } from "@/lib/supabase/browser";
import { SignInGate } from "./SignInGate";

type Dimension = { id: string; slug: string; name: string; description: string | null; sensitive: boolean };
type CohortValue = { id: string; dimension_id: string; slug: string; label: string; sort_order: number };

export function PreferenceProfile() {
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [values, setValues] = useState<CohortValue[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState("Connecting your private profile…");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const client = getBrowserSupabaseClient();
    if (!client) {
      Promise.resolve().then(() => { if (active) setStatus("Add the Supabase URL and publishable key to enable preference profiles."); });
      return;
    }
    Promise.resolve().then(async () => {
      const user = await requirePermanentRankedUser(client);
      const [dimensionResult, valueResult, selectedResult] = await Promise.all([
        client.from("cohort_dimensions").select("id, slug, name, description, sensitive").eq("status", "active").order("name"),
        client.from("cohort_values").select("id, dimension_id, slug, label, sort_order").order("sort_order"),
        client.from("user_cohort_values").select("cohort_value_id").eq("user_id", user.id),
      ]);
      if (dimensionResult.error) throw dimensionResult.error;
      if (valueResult.error) throw valueResult.error;
      if (selectedResult.error) throw selectedResult.error;
      if (!active) return;
      const loadedDimensions = dimensionResult.data ?? [];
      const loadedValues = valueResult.data ?? [];
      const selectedIds = new Set((selectedResult.data ?? []).map((row) => row.cohort_value_id));
      setDimensions(loadedDimensions);
      setValues(loadedValues);
      setSelected(Object.fromEntries(loadedDimensions.flatMap((dimension) => {
        const match = loadedValues.find((value) => value.dimension_id === dimension.id && selectedIds.has(value.id));
        return match ? [[dimension.slug, match.id]] : [];
      })));
      setUserId(user.id);
      setStatus("Only aggregate patterns from consenting users are shown, and never below 25 people.");
    }).catch((reason: unknown) => {
      if (active) setStatus(reason instanceof Error ? reason.message : "Profile setup failed.");
    });
    return () => { active = false; };
  }, []);

  const valuesByDimension = useMemo(() => new Map(dimensions.map((dimension) => [dimension.id, values.filter((value) => value.dimension_id === dimension.id)])), [dimensions, values]);

  async function saveProfile() {
    const client = getBrowserSupabaseClient();
    if (!client || !userId) return;
    setSaving(true);
    setStatus("Saving your consented preferences…");
    try {
      const { error: deleteError } = await client.from("user_cohort_values").delete().eq("user_id", userId);
      if (deleteError) throw deleteError;
      const rows = Object.values(selected).filter(Boolean).map((cohortValueId) => ({ user_id: userId, cohort_value_id: cohortValueId, source: "self-selected" }));
      if (rows.length) {
        const { error } = await client.from("user_cohort_values").insert(rows);
        if (error) throw error;
      }
      const { error: profileError } = await client.from("profiles").update({ demographic_consent: rows.length > 0 }).eq("id", userId);
      if (profileError) throw profileError;
      setStatus("Saved. Your individual selections remain private; only privacy-cleared aggregates can use them.");
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : "The profile could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="preference-card">
      <div className="preference-heading"><div><p className="kicker">OPTIONAL CONTEXT</p><h2>Your ranking perspective</h2><p>Choose only what you want to share. Ranked stores coarse categories, never exact age or location.</p></div><span className="privacy-pill">25+ privacy floor</span></div>
      <div className="preference-grid">
        {dimensions.filter((dimension) => dimension.slug !== "participation").map((dimension) => (
          <label key={dimension.id}><span>{dimension.name}{dimension.sensitive ? " · optional sensitive field" : ""}</span><select value={selected[dimension.slug] ?? ""} onChange={(event) => setSelected((current) => ({ ...current, [dimension.slug]: event.target.value }))}><option value="">Prefer not to say</option>{(valuesByDimension.get(dimension.id) ?? []).map((value) => <option key={value.id} value={value.id}>{value.label}</option>)}</select><small>{dimension.description}</small></label>
        ))}
      </div>
      <div className="preference-footer"><p>{status}</p><button className="button button-primary" disabled={!userId || saving} onClick={saveProfile}>{saving ? "Saving…" : "Save private profile"}</button></div>
      {!userId && <SignInGate />}
    </section>
  );
}
