"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { rankableCategory } from "@/lib/domain/rankableCatalog";
import type { CustomPollConfig, DatasetEnvelope, PlatformStatus, PollCatalog, RankingSubject } from "@/lib/domain/types";
import { timeAgo } from "@/lib/utils";

const GROUP_ORDER = ["Programs", "People", "Competition", "Places", "History", "Culture"] as const;
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
        <div><p className="kicker">ASK ANYTHING. RANK REAL THINGS.</p><h1>Create a ranking in minutes.</h1><p>Write the question. Choose a real college-football category. Ranked supplies the eligible options, connected data, and comparison tools.</p></div>
        <div className="creator-receipt">
          <span className={platformStatus?.schemaReady ? "data-badge is-live" : "data-badge"}>{platformStatus?.schemaReady ? "Relational catalog ready" : "Database setup pending"}</span>
          <strong>No typed-in options</strong>
          <small>Every choice carries a stable entity ID, source record, season, relationships, and comparable metrics.</small>
          {catalog && <><span className={catalog.connected ? "data-badge is-live" : "data-badge"}>{catalog.connected ? "CFBD snapshot connected" : "Demo catalog"}</span><small>{catalog.sourceLabel} · updated {timeAgo(catalog.refreshedAt)}</small></>}
          {loadError && <strong className="stale-warning">{loadError}</strong>}
        </div>
      </section>

      <section className="creator-shell shell">
        <div className="creator-step">
          <div className="creator-step-heading"><span>01</span><div><h2>Choose what can be ranked.</h2><p>These are real, connected records—not a text box pretending to be a database.</p></div></div>
          <div className="season-switcher"><span>Season</span>{(catalog?.availableYears ?? [2025, 2026]).map((value) => <button key={value} className={year === value ? "active" : ""} onClick={() => { setYear(value); setFilters({}); setCatalog(null); setLoadError(""); setPreviewState("loading"); }}>{value}</button>)}</div>
          {GROUP_ORDER.map((group) => {
            const options = (catalog?.subjects ?? []).filter((option) => option.group === group);
            if (!options.length) return null;
            return <div className="subject-section" key={group}><h3>{group}</h3><div className="subject-grid">{options.map((option) => (
              <button key={option.id} disabled={option.available === false} className={`${subject === option.id ? "subject-card active" : "subject-card"}${option.available === false ? " unavailable" : ""}`} onClick={() => chooseSubject(option.id)}>
                <span>{subject === option.id ? "✓" : option.icon}</span><strong>{option.label}</strong><small>{option.description}</small><em>{option.count.toLocaleString()} options · {option.metricCount ?? 0} metrics</em>
              </button>
            ))}</div></div>;
          })}
          {!catalog && !loadError && <div className="catalog-skeleton">Loading the rankable catalog…</div>}
        </div>

        <div className="creator-step">
          <div className="creator-step-heading"><span>02</span><div><h2>Narrow the eligible pool.</h2><p>Filters define which canonical records appear. Leave them broad for an open question.</p></div></div>
          {availableFilters.length ? <div className="creator-form-grid">{availableFilters.map((filter) => (
            <label className="creator-field" key={filter.key}><span>{filter.label}</span><select value={filters[filter.key] ?? "All"} onChange={(event) => { setPreviewState("loading"); setFilters((current) => ({ ...current, [filter.key]: event.target.value })); }}><option value="All">All {filter.label.toLocaleLowerCase()}</option>{filter.values.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          ))}</div> : <div className="no-filter-note"><strong>Everyone is eligible.</strong><span>This category does not need a filter for {year}.</span></div>}
          <div className={`pool-receipt ${previewState}`}><div><span>ELIGIBLE OPTIONS</span><strong>{previewState === "loading" ? "Loading…" : optionCount.toLocaleString()}</strong></div><div><span>COMPARISON METRICS</span><strong>{previewState === "loading" ? "Loading…" : metricCount.toLocaleString()}</strong></div><div><span>SOURCE</span><strong>{preview?.sourceLabel ?? catalog?.sourceLabel ?? "Saved catalog"}</strong></div></div>
        </div>

        <div className="creator-step">
          <div className="creator-step-heading"><span>03</span><div><h2>Ask the question.</h2><p>The wording is yours. The answer choices remain clean, searchable, and relational.</p></div></div>
          {!!selectedSubject?.exampleQuestions?.length && <div className="question-starters"><span>START WITH AN IDEA</span>{selectedSubject.exampleQuestions.map((example) => <button key={example} onClick={() => chooseExample(example)}>{example}</button>)}</div>}
          <div className="creator-form-grid">
            <label className="creator-field wide"><span>Ranking question or title</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} placeholder="Most likely team to win the national title" /></label>
            <label className="creator-field wide"><span>Guidance for rankers (optional)</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explain what should count, the time horizon, or how you want ties interpreted." rows={3} /></label>
            <label className="creator-field"><span>Number of ranked spots</span><input type="number" min={2} max={Math.min(50, Math.max(2, optionCount))} value={length} onChange={(event) => setLength(Number(event.target.value))} /></label>
            <label className="creator-field"><span>Visibility</span><select value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)}><option value="public">Public · eligible for consensus</option><option value="unlisted">Unlisted · anyone with link</option><option value="private">Private draft</option></select></label>
          </div>
          <div className="creator-summary"><div><span>QUESTION</span><strong>{title || "Untitled ranking"}</strong></div><div><span>FORMAT</span><strong>Top {length || 0} from {optionCount.toLocaleString()} {selectedSubject?.label.toLocaleLowerCase() ?? "options"}</strong></div><button className="button button-primary" onClick={createPoll}>Start ranking →</button></div>
          <p className="creator-guardrail">You can build and save locally without an account. Sign in only when you publish or contribute to consensus.</p>
          {error && <p className="creator-error" role="alert">{error}</p>}
        </div>
      </section>
    </div>
  );
}
