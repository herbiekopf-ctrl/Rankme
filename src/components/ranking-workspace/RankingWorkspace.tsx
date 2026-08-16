"use client";

import Link from "next/link";
import { AnalysisPane } from "./AnalysisPane";
import { CustomMetricBuilder } from "./CustomMetricBuilder";
import { EntityDetailSheet } from "./EntityDetailSheet";
import { MobileRankingTray } from "./MobileRankingTray";
import { PublishDialog } from "./PublishDialog";
import { RankingPane } from "./RankingPane";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { useRankingWorkspace } from "@/hooks/useRankingWorkspace";
import type { CustomPollConfig, DatasetEnvelope, RankingTemplate } from "@/lib/domain/types";
import { timeAgo } from "@/lib/utils";

export function RankingWorkspace({
  template,
  initialDataset,
  customConfig,
}: {
  template: RankingTemplate;
  initialDataset: DatasetEnvelope;
  customConfig?: CustomPollConfig;
}) {
  const controller = useRankingWorkspace({ template, initialDataset, customConfig });
  const sourceBadge = initialDataset.connected ? "Season data ready" : "Season data unavailable";

  return (
    <main className="rw-page">
      <section className="rw-heading shell">
        <div>
          <Link className="back-link" href={customConfig ? "/create" : "/"}>← {customConfig ? "Create another poll" : "Back to home"}</Link>
          <p className="kicker">{template.eyebrow}</p>
          <h1>{template.title}</h1>
          <p>{template.description}</p>
        </div>
        <div className="builder-meta">
          <span className={initialDataset.source === "collegefootballdata" ? "data-badge is-live" : "data-badge"}>{sourceBadge}</span>
          <small>{initialDataset.entities.length} options · updated {timeAgo(initialDataset.refreshedAt)}</small>
          {!!initialDataset.warnings?.length && <strong className="stale-warning">Some season data may still be updating.</strong>}
        </div>
      </section>

      <section className="rw-shell shell">
        <WorkspaceHeader controller={controller} />
        {!initialDataset.entities.length ? (
          <div className="builder-empty-state">
            <p className="kicker">OPTIONS UNAVAILABLE</p>
            <h2>This ranking is still loading.</h2>
            <p>Try again shortly.</p>
          </div>
        ) : (
          <div className="rw-grid">
            <RankingPane controller={controller} />
            <AnalysisPane controller={controller} />
          </div>
        )}
      </section>

      <EntityDetailSheet controller={controller} />
      {controller.analysisMode === "metric-builder" && <CustomMetricBuilder controller={controller} />}
      <PublishDialog controller={controller} />
      {!!initialDataset.entities.length && <MobileRankingTray controller={controller} />}
    </main>
  );
}
