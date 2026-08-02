"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CustomPollConfig, PollCatalog, RankingSubject } from "@/lib/domain/types";
import { timeAgo } from "@/lib/utils";

const DEFAULT_TITLES: Record<RankingSubject, string> = {
  teams: "My College Football Top 25",
  "conference-teams": "Best Schools in the ACC",
  mascots: "Best Mascots in College Football",
  towns: "Best College Football Towns",
  stadiums: "Best College Football Stadiums",
  players: "Best Wide Receivers in College Football",
  manual: "My Custom Ranking",
};

export function PollCreator() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<PollCatalog | null>(null);
  const [loadError, setLoadError] = useState("");
  const [subject, setSubject] = useState<RankingSubject>("teams");
  const [title, setTitle] = useState(DEFAULT_TITLES.teams);
  const [conference, setConference] = useState("ACC");
  const [position, setPosition] = useState("WR");
  const [length, setLength] = useState(25);
  const [manualText, setManualText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/college-football/catalog?year=2026")
      .then((response) => response.ok ? response.json() as Promise<PollCatalog> : Promise.reject(new Error("Catalog unavailable")))
      .then(setCatalog)
      .catch(() => setLoadError("The college football option catalog could not be loaded."));
  }, []);

  const selectedSubject = useMemo(() => catalog?.subjects.find((option) => option.id === subject), [catalog, subject]);
  const manualOptions = useMemo(() => [...new Set(manualText.split("\n").map((value) => value.trim()).filter(Boolean))], [manualText]);

  function chooseSubject(next: RankingSubject) {
    const option = catalog?.subjects.find((candidate) => candidate.id === next);
    if (option?.available === false) return;
    setSubject(next);
    setTitle(DEFAULT_TITLES[next]);
    setLength(next === "teams" ? 25 : 10);
    setError("");
  }

  function createPoll() {
    const cleanTitle = title.trim();
    if (!cleanTitle) return setError("Give your poll a title.");
    if (!Number.isInteger(length) || length < 2 || length > 50) return setError("Choose a ranking length between 2 and 50.");
    if (subject === "conference-teams" && !conference) return setError("Choose a conference.");
    if (subject === "players" && !position) return setError("Choose a player position.");
    if (subject === "manual" && manualOptions.length < length) return setError(`Add at least ${length} unique options.`);

    const id = crypto.randomUUID();
    const config: CustomPollConfig = {
      id,
      title: cleanTitle,
      subject,
      length,
      conference: subject === "conference-teams" || subject === "players" ? conference || undefined : undefined,
      position: subject === "players" ? position : undefined,
      manualOptions: subject === "manual" ? manualOptions : undefined,
      createdAt: new Date().toISOString(),
    };
    window.localStorage.setItem(`ranked:custom-poll:${id}`, JSON.stringify(config));
    let index: string[] = [];
    try {
      const savedIndex = JSON.parse(window.localStorage.getItem("ranked:custom-polls") ?? "[]") as unknown;
      if (Array.isArray(savedIndex)) index = savedIndex.filter((value): value is string => typeof value === "string");
    } catch {
      index = [];
    }
    window.localStorage.setItem("ranked:custom-polls", JSON.stringify([id, ...index.filter((value) => value !== id)].slice(0, 20)));
    router.push(`/rank/custom/${id}`);
  }

  return (
    <div className="creator-page">
      <section className="creator-hero shell">
        <div><p className="kicker">BUILD THE QUESTION</p><h1>Create your own poll.</h1><p>Choose what people are ranking, narrow the option pool, and use the same fast ranking workflow as the Top 25.</p></div>
        <div className="creator-receipt">
          <span className={catalog?.connected ? "data-badge is-live" : "data-badge"}>{catalog?.connected ? "CFBD snapshot connected" : "Loading data"}</span>
          {catalog && <><strong>{catalog.sourceLabel}</strong><small>Saved {timeAgo(catalog.refreshedAt)} · {catalog.upstreamRequests} calls per shared refresh, not per user</small>{catalog.warnings?.map((warning) => <small className="catalog-warning" key={warning}>{warning}</small>)}</>}
          {loadError && <strong className="stale-warning">{loadError}</strong>}
        </div>
      </section>

      <section className="creator-shell shell">
        <div className="creator-step">
          <div className="creator-step-heading"><span>01</span><div><h2>What are people ranking?</h2><p>These lists are generated from the saved college football dataset.</p></div></div>
          <div className="subject-grid">
            {(catalog?.subjects ?? [
              { id: "teams" as const, label: "All FBS teams", description: "Every FBS school.", count: 0 },
              { id: "conference-teams" as const, label: "Conference schools", description: "ACC, SEC, Big Ten, and more.", count: 0 },
              { id: "mascots" as const, label: "Mascots", description: "Every team mascot.", count: 0 },
              { id: "towns" as const, label: "College towns", description: "FBS host cities and towns.", count: 0 },
              { id: "stadiums" as const, label: "Stadiums", description: "Venues and capacities.", count: 0 },
              { id: "players" as const, label: "Players by position", description: "WR, QB, RB, and more.", count: 0 },
              { id: "manual" as const, label: "My own options", description: "Paste any list.", count: 0 },
            ]).map((option) => (
              <button key={option.id} disabled={option.available === false} className={`${subject === option.id ? "subject-card active" : "subject-card"}${option.available === false ? " unavailable" : ""}`} onClick={() => chooseSubject(option.id)}>
                <span>{subject === option.id ? "✓" : "+"}</span><strong>{option.label}</strong><small>{option.description}</small>{option.count > 0 && <em>{option.count.toLocaleString()} available</em>}
              </button>
            ))}
          </div>
        </div>

        <div className="creator-step">
          <div className="creator-step-heading"><span>02</span><div><h2>Shape the option pool.</h2><p>Users will only rank options from the list you define here.</p></div></div>
          <div className="creator-form-grid">
            <label className="creator-field wide"><span>Poll title</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} /></label>
            {(subject === "conference-teams" || subject === "players") && <label className="creator-field"><span>Conference {subject === "players" && "(optional)"}</span><select value={conference} onChange={(event) => setConference(event.target.value)}>{subject === "players" && <option value="">All conferences</option>}{(catalog?.conferences ?? ["ACC", "SEC", "Big Ten", "Big 12"]).map((value) => <option key={value}>{value}</option>)}</select></label>}
            {subject === "players" && <label className="creator-field"><span>Position</span><select value={position} onChange={(event) => setPosition(event.target.value)}>{(catalog?.positions ?? ["WR", "QB", "RB", "TE"]).map((value) => <option key={value}>{value}</option>)}</select></label>}
            <label className="creator-field"><span>Number of ranked spots</span><input type="number" min={2} max={50} value={length} onChange={(event) => setLength(Number(event.target.value))} /></label>
            {subject === "manual" && <label className="creator-field wide"><span>Options · one per line</span><textarea value={manualText} onChange={(event) => setManualText(event.target.value)} placeholder={"Clemson\nGeorgia\nOhio State\nOregon"} rows={9} /><small>{manualOptions.length} unique options entered</small></label>}
          </div>
          <div className="creator-summary"><div><span>OPTION SOURCE</span><strong>{selectedSubject?.label ?? DEFAULT_TITLES[subject]}</strong></div><div><span>POLL LENGTH</span><strong>Top {length || 0}</strong></div><button className="button button-primary" onClick={createPoll}>Create ranking workflow →</button></div>
          {error && <p className="creator-error" role="alert">{error}</p>}
        </div>
      </section>
    </div>
  );
}
