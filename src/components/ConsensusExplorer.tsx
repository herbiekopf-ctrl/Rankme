"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";

type BrowsePoll = { id: string; slug: string | null; title: string; template_kind: string; created_at: string };

export function ConsensusExplorer() {
  const [polls, setPolls] = useState<BrowsePoll[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    const client = getBrowserSupabaseClient();
    if (!client) { Promise.resolve().then(() => setState("unavailable")); return; }
    client.from("ranking_templates").select("id, slug, title, template_kind, created_at").eq("status", "active").order("created_at", { ascending: false }).limit(50)
      .then(({ data, error }) => { if (error) setState("unavailable"); else { setPolls(data ?? []); setState("ready"); } });
  }, []);

  return <main className="browse-page shell">
    <section className="browse-heading"><div><p className="kicker">BROWSE</p><h1>Real polls. Real responses.</h1><p>Published rankings will be separated by poll, season, and weekly response period. Nothing below is sample data.</p></div><Link className="button button-primary" href="/create">Create a poll →</Link></section>
    {state === "loading" && <div className="browse-empty"><strong>Loading published polls…</strong></div>}
    {state === "unavailable" && <div className="browse-empty"><strong>Browse is not connected yet.</strong><p>Initialize Supabase and import CFBD data before public polls can appear.</p></div>}
    {state === "ready" && <div className="browse-grid">{polls.map((poll) => <article className="browse-card" key={poll.id}><span>{poll.template_kind === "official" ? "OFFICIAL" : "COMMUNITY"}</span><h2>{poll.title}</h2><p>Consensus appears only after real published ballots exist for the selected period.</p>{poll.slug === "official-top-25" ? <Link href="/rank/top-25">Open Top 25 →</Link> : <em>Awaiting published responses</em>}</article>)}</div>}
    {state === "ready" && !polls.length && <div className="browse-empty"><strong>No published polls yet.</strong><p>Create the first one after the real-data import.</p></div>}
  </main>;
}
