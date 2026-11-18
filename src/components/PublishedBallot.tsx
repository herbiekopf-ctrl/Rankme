"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TeamDetailsButton } from "./TeamDetails";
import { TeamMark } from "./TeamMark";
import { buildCustomTemplate, customDatasetUrl, decodeCustomPollConfig } from "@/lib/domain/customPolls";
import { getTemplate } from "@/lib/domain/templates";
import type { DatasetEnvelope } from "@/lib/domain/types";
import { ballotPeriodReceipt } from "@/lib/domain/rankingPeriods";
import { formatAttribute } from "@/lib/utils";

export function PublishedBallot({
  slug,
  entityIds,
  templateId,
  customConfigRaw,
}: {
  slug: string;
  entityIds: string[];
  templateId: string;
  customConfigRaw?: string;
}) {
  const customConfig = useMemo(() => decodeCustomPollConfig(customConfigRaw), [customConfigRaw]);
  const template = customConfig ? buildCustomTemplate(customConfig) : getTemplate(templateId) ?? getTemplate("top-25")!;
  const [dataset, setDataset] = useState<DatasetEnvelope>({ id: "loading", version: "loading", source: "collegefootballdata", sourceLabel: "Loading saved data", refreshedAt: new Date(0).toISOString(), stale: false, connected: false, entities: [] });
  const receipt = ballotPeriodReceipt(slug, customConfig?.year);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (customConfig) {
      fetch(customDatasetUrl(customConfig))
        .then((response) => response.ok ? response.json() as Promise<DatasetEnvelope> : Promise.reject(new Error("Dataset failed")))
        .then(setDataset)
        .catch(() => undefined);
      return;
    }
    const datasetUrl = template.entityType === "team"
        ? `/api/college-football/teams?year=${receipt.season}`
        : null;
    if (!datasetUrl) return;
    fetch(datasetUrl)
      .then((response) => response.ok ? response.json() as Promise<DatasetEnvelope> : Promise.reject(new Error("Dataset failed")))
      .then(setDataset)
      .catch(() => undefined);
  }, [customConfig, template.entityType, receipt.season]);

  const entitiesById = useMemo(() => new Map(dataset.entities.map((entity) => [entity.id, entity])), [dataset.entities]);
  const entities = entityIds.map((id) => entitiesById.get(id)).filter(Boolean);


  async function share() {
    if (navigator.share) {
      await navigator.share({ title: template.title, text: "Here is my ranking. What did I get wrong?", url: window.location.href });
      return;
    }
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="published-page">
      <section className="published-hero shell">
        <div>
          <p className="kicker">BALLOT</p>
          <h1>{template.title}</h1>
          <p className="published-byline">{receipt.label}</p>
        </div>
        <div className="published-actions">
          <button className="button button-secondary" onClick={share}>{copied ? "Link copied" : "Share ballot ↗"}</button>
          <Link className="button button-primary" href={customConfig ? "/create" : `/rank/${template.id}`}>{customConfig ? "Create your poll" : "Make yours"}</Link>
        </div>
      </section>

      <section className="shell published-grid">
        <div className="public-ballot-card">
          <div className="public-card-top">
            <div><span>RANKED</span><strong>{customConfig?.title ?? "Top 25"}</strong></div>
            <span>{receipt.label}</span>
          </div>
          <div className="public-list">
            {entities.map((entity, index) => entity && (
              <article key={entity.id} className={index < 5 ? "public-row featured-row" : "public-row"}>
                <span className="public-rank">{index + 1}</span>
                <TeamMark entity={entity} size={index < 5 ? "large" : "medium"} />
                <div><strong>{entity.entityType === "team" ? <TeamDetailsButton team={entity} season={receipt.season} /> : entity.name}</strong>{template.visibleAttributes.length > 0 && <span>{template.visibleAttributes.slice(0, 2).map((key) => formatAttribute(entity.attributes[key])).join(" · ")}</span>}</div>
              </article>
            ))}
            {!entities.length && <div className="real-data-empty"><strong>This ranking is unavailable right now.</strong><span>Try again shortly or reopen a valid published link.</span></div>}
          </div>
          <div className="public-card-footer"><span>Published order preserved</span></div>
        </div>

        <aside className="ballot-insights">
          <Link className="consensus-callout" href="/rankings"><span>Compare the country</span><strong>Open rankings →</strong></Link>
        </aside>
      </section>
    </div>
  );
}
