"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TeamMark } from "./TeamMark";
import { buildCustomTemplate, customDatasetUrl, decodeCustomPollConfig } from "@/lib/domain/customPolls";
import { seedStadiumDataset, seedTeamDataset } from "@/lib/domain/seed";
import { getTemplate } from "@/lib/domain/templates";
import type { DatasetEnvelope } from "@/lib/domain/types";
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
  const [dataset, setDataset] = useState<DatasetEnvelope>(() => customConfig
    ? { id: "custom-loading", version: "loading", source: "seed", sourceLabel: "Loading saved snapshot", refreshedAt: customConfig.createdAt, stale: false, connected: false, entities: [] }
    : template.entityType === "stadium" ? seedStadiumDataset() : seedTeamDataset());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (customConfig) {
      fetch(customDatasetUrl(customConfig))
        .then((response) => response.ok ? response.json() as Promise<DatasetEnvelope> : Promise.reject(new Error("Dataset failed")))
        .then(setDataset)
        .catch(() => undefined);
      return;
    }
    const datasetUrl = template.entityType === "stadium"
      ? "/api/college-football/rankables?year=2026&subject=stadiums"
      : template.entityType === "team"
        ? "/api/college-football/teams?year=2026"
        : null;
    if (!datasetUrl) return;
    fetch(datasetUrl)
      .then((response) => response.ok ? response.json() as Promise<DatasetEnvelope> : Promise.reject(new Error("Dataset failed")))
      .then(setDataset)
      .catch(() => undefined);
  }, [customConfig, template.entityType]);

  const entitiesById = useMemo(() => new Map(dataset.entities.map((entity) => [entity.id, entity])), [dataset.entities]);
  const fallbackIds = dataset.entities.slice(0, template.defaultLength).map((entity) => entity.id);
  const resolvedIds = entityIds.length ? entityIds : fallbackIds;
  const entities = resolvedIds.map((id) => entitiesById.get(id)).filter(Boolean);
  const sourceStatus = dataset.source === "collegefootballdata" ? "CFBD snapshot connected" : dataset.source === "seed" ? "Demo dataset" : "Saved option dataset";

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
          <p className="kicker">PUBLISHED RECEIPTS</p>
          <h1>{template.title}</h1>
          <p className="published-byline"><span className="avatar">H</span> Herb · @herb <span>•</span> {slug.replaceAll("-", " ")}</p>
        </div>
        <div className="published-actions">
          <button className="button button-secondary" onClick={share}>{copied ? "Link copied" : "Share ballot ↗"}</button>
          <Link className="button button-primary" href={customConfig ? "/create" : `/rank/${template.id}`}>{customConfig ? "Create your poll" : "Make yours"}</Link>
        </div>
      </section>

      <section className="shell published-grid">
        <div className="public-ballot-card">
          <div className="public-card-top">
            <div><span>RANKED</span><strong>{customConfig ? customConfig.title.toLocaleUpperCase() : template.entityType === "team" ? "2026 PRESEASON TOP 25" : "BEST CFB STADIUMS"}</strong></div>
            <span>{dataset.sourceLabel}</span>
          </div>
          <div className="public-list">
            {entities.map((entity, index) => entity && (
              <article key={entity.id} className={index < 5 ? "public-row featured-row" : "public-row"}>
                <span className="public-rank">{index + 1}</span>
                <TeamMark entity={entity} size={index < 5 ? "large" : "medium"} />
                <div><strong>{entity.name}</strong>{template.visibleAttributes.length > 0 && <span>{template.visibleAttributes.slice(0, 2).map((key) => formatAttribute(entity.attributes[key])).join(" · ")}</span>}</div>
                <span className="consensus-delta">{index % 4 === 1 ? "+2" : index % 4 === 3 ? "−1" : "—"}</span>
              </article>
            ))}
          </div>
          <div className="public-card-footer"><span>Published Aug 1, 2026</span><span>Dataset snapshot · {dataset.version}</span></div>
        </div>

        <aside className="ballot-insights">
          <div className="insight-card">
            <span>YOUR BIGGEST TAKE</span>
            <strong>Not following the crowd.</strong>
            <p>{customConfig ? "This poll uses the exact option list and order chosen by its creator." : "Your order differs from the demo national consensus in 17 of 25 positions."}</p>
          </div>
          <div className="insight-card">
            <span>DATA RECEIPT</span>
            <strong>{sourceStatus}</strong>
            <p>Every published list carries its source and version so the context cannot silently change later.</p>
          </div>
          <Link className="consensus-callout" href="/consensus"><span>Compare the country</span><strong>Open consensus →</strong></Link>
        </aside>
      </section>
    </div>
  );
}
