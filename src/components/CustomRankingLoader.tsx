"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RankingBuilder } from "./RankingBuilder";
import { buildCustomTemplate, createManualDataset, customDatasetUrl, decodeCustomPollConfig } from "@/lib/domain/customPolls";
import type { CustomPollConfig, DatasetEnvelope } from "@/lib/domain/types";

export function CustomRankingLoader({ pollId }: { pollId: string }) {
  const [config, setConfig] = useState<CustomPollConfig | null>(null);
  const [dataset, setDataset] = useState<DatasetEnvelope | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      const parsed = decodeCustomPollConfig(window.localStorage.getItem(`ranked:custom-poll:${pollId}`) ?? undefined);
      if (!parsed) throw new Error("This custom poll is not saved in this browser or its configuration is invalid.");
      if (!active) return;
      setConfig(parsed);
      if (parsed.subject === "manual") {
        setDataset(createManualDataset(parsed));
        return;
      }
      const response = await fetch(customDatasetUrl(parsed));
      if (!response.ok) throw new Error("The saved CFBD option list is unavailable.");
      const nextDataset = await response.json() as DatasetEnvelope;
      if (nextDataset.entities.length < parsed.length) throw new Error(`Only ${nextDataset.entities.length} matching options are available. Create a new poll with fewer spots.`);
      if (active) setDataset(nextDataset);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "The option list could not be loaded.");
    });
    return () => { active = false; };
  }, [pollId]);

  if (error) return <section className="loader-state shell"><p className="kicker">POLL UNAVAILABLE</p><h1>We couldn&apos;t open that ranking.</h1><p>{error}</p><Link className="button button-primary" href="/create">Create a new poll</Link></section>;
  if (!config || !dataset) return <section className="loading-page shell"><div className="skeleton skeleton-title" /><div className="skeleton skeleton-panel" /></section>;
  return <RankingBuilder template={buildCustomTemplate(config)} initialDataset={dataset} customConfig={config} />;
}
