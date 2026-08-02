"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { rankableCategory } from "@/lib/domain/rankableCatalog";
import type { CustomPollConfig, DatasetEnvelope, PlatformStatus, PollCatalog, RankingSubject } from "@/lib/domain/types";
const FILTER_LABELS: Record<string, string> = { conference: "Conference", team: "Team", position: "Position", classYear: "Class", week: "Week", completed: "Game status", conferenceGame: "Conference game", state: "State", dome: "Dome", grass: "Grass field", committedTo: "Committed to", stars: "Stars", origin: "From", destination: "To", side: "Unit", collegeConference: "College conference", collegeTeam: "College", round: "Draft round" };

function filterValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function saveLocalPoll(config: CustomPollConfig) {
  window.localStorage.setItem(`ranked:custom-poll:${config.id}`, JSON.stringify(config));
  let index: string[] = [];
  try {
    const saved = JSON.parse(window.localStorage.getItem("ranked:custom-polls") ?? "[]") as unknown;
    if (Array.isArray(saved)) index = saved.filter((value): value is string => typeof value === "string");
  } catch {
    index = [];
  }
  window.localStorage.setItem("ranked:custom-polls", JSON.stringify([config.id, ...index.filter((id) => id !== config.id)].slice(0, 20)));
}

export function PollCreator() {
  const router = useRouter();
  const [year, setYear] = useState(2026);
  const [catalog, setCatalog] = useState<PollCatalog | null>(null);
  const [subject, setSubject] = useState<RankingSubject>("teams");
  const [title, setTitle] = useState(rankableCategory("teams").defaultTitle);
  const [length, setLength] = useState(rankableCategory("teams").defaultLength);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<NonNullable<CustomPollConfig["visibility"]>>("public");
  const [platformStatus, setPlatformStatus] = useState<PlatformStatus | null>(null);
  const [preview, setPreview] = useState<DatasetEnvelope | null>(null);
  const [loadError, setLoadError] = useState("");
  const [previewState, setPreviewState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/college-football/catalog?year=${year}`)
      .then((response) => response.ok ? response.json() as Promise<PollCatalog> : Promise.reject(new Error("Catalog unavailable")))
      .then((next) => { if (active) setCatalog(next); })
      .catch(() => { if (active) setLoadError("The saved college football catalog could not be loaded."); });
    return () => { active = false; };
  }, [year]);

  useEffect(() => {
    fetch("/api/platform/status")
      .then((response) => response.ok ? response.json() as Promise<PlatformStatus> : Promise.reject(new Error("Database status unavailable")))
      .then(setPlatformStatus)
      .catch(() => setPlatformStatus(null));
  }, []);

  const selectedSubject = useMemo(() => catalog?.subjects.find((option) => option.id === subject), [catalog, subject]);
  const availableFilters = useMemo(() => {
    if (selectedSubject?.filters?.length) return selectedSubject.filters;
    if (!preview) return [];
    return rankableCategory(subject).filterKeys.flatMap((key) => {
      const values = [...new Set(preview.entities.map((entity) => filterValue(entity.attributes[key])).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      return values.length > 1 ? [{ key, label: FILTER_LABELS[key] ?? key, values }] : [];
    });
  }, [preview, selectedSubject, subject]);
  const filterQuery = useMemo(() => new URLSearchParams(Object.entries(filters).filter(([, value]) => value && value !== "All")).toString(), [filters]);

  useEffect(() => {
    let active = true;
    const suffix = filterQuery ? `&${filterQuery}` : "";
    fetch(`/api/college-football/rankables?year=${year}&subject=${subject}${suffix}`)
      .then((response) => response.ok ? response.json() as Promise<DatasetEnvelope> : Promise.reject(new Error("Option pool unavailable")))
      .then((dataset) => {
        if (!active) return;
        setPreview(dataset);
        setPreviewState("ready");
      })
      .catch(() => {
        if (!active) return;
        setPreview(null);
        setPreviewState("error");
      });
    return () => { active = false; };
  }, [filterQuery, subject, year]);

  function chooseSubject(next: RankingSubject) {
    const option = catalog?.subjects.find((candidate) => candidate.id === next);
    if (option?.available === false) return;
    const definition = rankableCategory(next);
    setSubject(next);
    setTitle(definition.defaultTitle);
    setLength(definition.defaultLength);
    setFilters({});
    setPreviewState("loading");
    setError("");
  }

  function chooseExample(example: string) {
    setTitle(example);
    setError("");
  }

  function createPoll() {
    const cleanTitle = title.trim();
    const optionCount = preview?.entities.length ?? 0;
    if (!cleanTitle) return setError("Write the question people are answering.");
    if (!Number.isInteger(length) || length < 2 || length > 50) return setError("Choose between 2 and 50 ranked spots.");
    if (previewState !== "ready") return setError("Wait for the eligible option pool to finish loading.");
    if (optionCount < length) return setError(`This pool has ${optionCount} eligible options. Use fewer ranked spots or broaden a filter.`);
    const definition = rankableCategory(subject);
    const id = crypto.randomUUID();
    const config: CustomPollConfig = {
      id,
      title: cleanTitle,
      subject,
      entityType: definition.entityType,
      year,
      length,
      filters: Object.fromEntries(Object.entries(filters).filter(([, value]) => value && value !== "All")),
      description: description.trim() || undefined,
      visibility,
      rankingMethod: "manual",
      createdAt: new Date().toISOString(),
    };
    saveLocalPoll(config);
    router.push(`/rank/custom/${id}`);
  }

  const optionCount = preview?.entities.length ?? selectedSubject?.count ?? 0;
  const metricCount = preview?.metricDefinitions?.length ?? selectedSubject?.metricCount ?? 0;

  return (
    <div className="creator-page">
      <section className="creator-hero shell">
        <div><p className="kicker">ONE POLL SLIP</p><h1>Create a poll.</h1><p>Ask the question, choose what people rank, and decide how long the list should be. The options and comparison data come from Ranked&apos;s real catalog.</p></div>
      </section>

      <section className="poll-slip shell">
        <div className="poll-slip-status">
          <span className={platformStatus?.schemaReady ? "data-badge is-live" : "data-badge"}>{platformStatus?.schemaReady ? "Database ready" : "Database setup pending"}</span>
          <span className={catalog?.connected ? "data-badge is-live" : "data-badge"}>{catalog?.connected ? "Real CFBD data connected" : "Real data not imported"}</span>
          {loadError && <strong className="stale-warning">{loadError}</strong>}
        </div>

        <div className="poll-slip-grid">
          <label className="creator-field wide"><span>What are people ranking?</span><select value={subject} onChange={(event) => chooseSubject(event.target.value as RankingSubject)} disabled={!catalog}>{(catalog?.subjects ?? []).map((option) => <option key={option.id} value={option.id} disabled={option.available === false}>{option.label}{option.available === false ? " · no imported data" : ` · ${option.count.toLocaleString()} options`}</option>)}</select></label>
          <label className="creator-field"><span>Season</span><select value={year} onChange={(event) => { setYear(Number(event.target.value)); setFilters({}); setCatalog(null); setLoadError(""); setPreviewState("loading"); }}>{(catalog?.availableYears ?? [2025, 2026]).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          {!!selectedSubject?.exampleQuestions?.length && <div className="question-starters"><span>START WITH AN IDEA</span>{selectedSubject.exampleQuestions.map((example) => <button key={example} onClick={() => chooseExample(example)}>{example}</button>)}</div>}
          <label className="creator-field wide"><span>Poll question or title</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} placeholder="Most likely team to win the national title" /></label>
          <label className="creator-field wide"><span>Guidance for rankers (optional)</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explain what should count or the time horizon." rows={3} /></label>

          {availableFilters.map((filter) => <label className="creator-field" key={filter.key}><span>{filter.label} (optional)</span><select value={filters[filter.key] ?? "All"} onChange={(event) => { setPreviewState("loading"); setFilters((current) => ({ ...current, [filter.key]: event.target.value })); }}><option value="All">All {filter.label.toLocaleLowerCase()}</option>{filter.values.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>)}
          <label className="creator-field"><span>How many items should each person rank?</span><input type="number" min={2} max={Math.min(50, Math.max(2, optionCount))} value={length} onChange={(event) => setLength(Number(event.target.value))} /></label>
          <label className="creator-field"><span>Visibility</span><select value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)}><option value="public">Public · included in consensus</option><option value="unlisted">Unlisted · link only</option><option value="private">Private draft</option></select></label>
        </div>

        <div className={`poll-slip-receipt ${previewState}`}>
          <div><span>REAL OPTIONS</span><strong>{previewState === "loading" ? "Loading…" : optionCount.toLocaleString()}</strong></div>
          <div><span>METRICS</span><strong>{previewState === "loading" ? "Loading…" : metricCount.toLocaleString()}</strong></div>
          <div><span>FORMAT</span><strong>Top {length || 0} {selectedSubject?.label.toLocaleLowerCase() ?? "items"}</strong></div>
          <button className="button button-primary" onClick={createPoll}>Open ranking workspace →</button>
        </div>
        {!catalog?.connected && <p className="real-data-empty">No poll can be created until the protected CFBD import loads real options into Supabase. Fake options are never substituted.</p>}
        <p className="creator-guardrail">You can build locally without an account. Publishing and contributing to consensus require sign-in. Every response is timestamped and assigned to its season/week period.</p>
        {error && <p className="creator-error" role="alert">{error}</p>}
      </section>
    </div>
  );
}
