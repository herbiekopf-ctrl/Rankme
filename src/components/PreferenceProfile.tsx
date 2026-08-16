"use client";

import { useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient, requirePermanentRankedUser } from "@/lib/supabase/browser";
import type { RankableEntity } from "@/lib/domain/types";
import { SignInGate } from "./SignInGate";
import { TeamMark } from "./TeamMark";

type Dimension = { id: string; slug: string; name: string; description: string | null; sensitive: boolean };
type CohortValue = { id: string; dimension_id: string; slug: string; label: string; sort_order: number };
type ProfileEntity = { id: string; name: string; imageUrl: string | null; color: string | null; entityType: "team" | "conference" };

function profileMark(entity: ProfileEntity): RankableEntity {
  return { id: entity.id, entityType: entity.entityType, name: entity.name, imageUrl: entity.imageUrl ?? undefined, color: entity.color ?? undefined, attributes: {} };
}

export function PreferenceProfile() {
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [values, setValues] = useState<CohortValue[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState("Connecting your private profile…");
  const [saving, setSaving] = useState(false);
  const [profileEntities, setProfileEntities] = useState<ProfileEntity[]>([]);
  const [affiliations, setAffiliations] = useState<{ favorite: string; conference_fan: string }>({ favorite: "", conference_fan: "" });

  useEffect(() => {
    let active = true;
    const client = getBrowserSupabaseClient();
    if (!client) {
      Promise.resolve().then(() => { if (active) setStatus("Private profiles are unavailable right now."); });
      return;
    }
    Promise.resolve().then(async () => {
      const user = await requirePermanentRankedUser(client);
      const [dimensionResult, valueResult, selectedResult, entityResult, affiliationResult] = await Promise.all([
        client.from("cohort_dimensions").select("id, slug, name, description, sensitive").eq("status", "active").order("name"),
        client.from("cohort_values").select("id, dimension_id, slug, label, sort_order").order("sort_order"),
        client.from("user_cohort_values").select("cohort_value_id").eq("user_id", user.id),
        client.from("entities").select("id,name,image_url,color,entity_types!inner(slug)").in("entity_types.slug", ["team", "conference"]).eq("status", "active").order("name"),
        client.from("user_entity_affiliations").select("entity_id,affiliation_type").eq("user_id", user.id).in("affiliation_type", ["favorite", "conference_fan"]),
      ]);
      if (dimensionResult.error) throw dimensionResult.error;
      if (valueResult.error) throw valueResult.error;
      if (selectedResult.error) throw selectedResult.error;
      if (entityResult.error) throw entityResult.error;
      if (affiliationResult.error) throw affiliationResult.error;
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
      setProfileEntities((entityResult.data ?? []).flatMap((entity) => {
        const type = Array.isArray(entity.entity_types) ? entity.entity_types[0] : entity.entity_types;
        if (type?.slug !== "team" && type?.slug !== "conference") return [];
        return [{ id: entity.id, name: entity.name, imageUrl: entity.image_url, color: entity.color, entityType: type.slug }];
      }));
      setAffiliations({
        favorite: affiliationResult.data?.find((row) => row.affiliation_type === "favorite")?.entity_id ?? "",
        conference_fan: affiliationResult.data?.find((row) => row.affiliation_type === "conference_fan")?.entity_id ?? "",
      });
      setUserId(user.id);
      setStatus("Only aggregate patterns are shown, and never below five matching voters.");
    }).catch(() => {
      if (active) setStatus("Profile setup is unavailable right now.");
    });
    return () => { active = false; };
  }, []);

  const valuesByDimension = useMemo(() => new Map(dimensions.map((dimension) => [dimension.id, values.filter((value) => value.dimension_id === dimension.id)])), [dimensions, values]);
  const teams = useMemo(() => profileEntities.filter((entity) => entity.entityType === "team"), [profileEntities]);
  const conferences = useMemo(() => profileEntities.filter((entity) => entity.entityType === "conference"), [profileEntities]);

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
      const { error: affiliationDeleteError } = await client.from("user_entity_affiliations").delete().eq("user_id", userId).in("affiliation_type", ["favorite", "conference_fan"]);
      if (affiliationDeleteError) throw affiliationDeleteError;
      const affiliationRows = (["favorite", "conference_fan"] as const).flatMap((affiliationType) => affiliations[affiliationType]
        ? [{ user_id: userId, entity_id: affiliations[affiliationType], affiliation_type: affiliationType }]
        : []);
      if (affiliationRows.length) {
        const { error: affiliationError } = await client.from("user_entity_affiliations").insert(affiliationRows);
        if (affiliationError) throw affiliationError;
      }
      const { error: profileError } = await client.from("profiles").update({ demographic_consent: rows.length > 0 || affiliationRows.length > 0 }).eq("id", userId);
      if (profileError) throw profileError;
      setStatus("Saved. Your individual selections remain private; only privacy-cleared aggregates can use them.");
    } catch {
      setStatus("The profile could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="preference-card">
      <div className="preference-heading"><div><p className="kicker">OPTIONAL CONTEXT</p><h2>Your ranking perspective</h2><p>Choose only what you want to share. Ranked stores coarse categories, never exact age or location.</p></div><span className="privacy-pill">5+ privacy floor</span></div>
      <div className="preference-grid">
        <div className="affiliation-fields">
          {([{"key":"favorite","label":"Favorite team","options":teams},{"key":"conference_fan","label":"Conference affiliation","options":conferences}] as const).map(({ key, label, options }) => {
            const selectedEntity = profileEntities.find((entity) => entity.id === affiliations[key]);
            return <label key={key} className="affiliation-field"><span>{label}</span><div>{selectedEntity && <TeamMark entity={profileMark(selectedEntity)} size="small" />}<select value={affiliations[key]} onChange={(event) => setAffiliations((current) => ({ ...current, [key]: event.target.value }))}><option value="">No selection</option>{options.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></div><small>Optional. Used only for private profile context and privacy-cleared group views.</small></label>;
          })}
        </div>
        {dimensions.filter((dimension) => dimension.slug !== "participation").map((dimension) => (
          <label key={dimension.id}><span>{dimension.name}{dimension.sensitive ? " · optional sensitive field" : ""}</span><select value={selected[dimension.slug] ?? ""} onChange={(event) => setSelected((current) => ({ ...current, [dimension.slug]: event.target.value }))}><option value="">Prefer not to say</option>{(valuesByDimension.get(dimension.id) ?? []).map((value) => <option key={value.id} value={value.id}>{value.label}</option>)}</select><small>{dimension.description}</small></label>
        ))}
      </div>
      <div className="preference-footer"><p>{status}</p><button className="button button-primary" disabled={!userId || saving} onClick={saveProfile}>{saving ? "Saving…" : "Save private profile"}</button></div>
      {!userId && <SignInGate />}
    </section>
  );
}
