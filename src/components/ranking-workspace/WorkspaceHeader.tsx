"use client";

import Link from "next/link";
import type { RankingWorkspaceController } from "@/hooks/useRankingWorkspace";

function saveLabel(state: RankingWorkspaceController["saveState"]) {
  if (state === "loading") return "Opening draft";
  if (state === "saving") return "Saving";
  if (state === "cloud") return "Saved to your account";
  return "Local draft saved";
}

export function WorkspaceHeader({ controller }: { controller: RankingWorkspaceController }) {
  const { history, mobileMode, periodContext, periodReady, saveState, template, validationErrors } = controller;
  const periodLabel = periodContext.responseCadence === "weekly"
    ? "THIS WEEK"
    : periodContext.responseCadence === "seasonal"
      ? "THIS SEASON"
      : "THIS POLL";
  const responseLabel = !periodReady
    ? "Checking…"
    : periodContext.status === "published"
      ? "✓ Submitted"
      : periodContext.status === "draft"
        ? "Draft in progress"
        : "New ranking";

  return (
    <header className="rw-toolbar">
      <div className={`rw-period-strip ${periodContext.status ?? "not-started"}`}>
        <div className="rw-period-identity">
          <span>{periodLabel}</span>
          <strong>{periodContext.periodTitle}</strong>
          <small>One response per person for this period.</small>
        </div>
        <div className="rw-period-state">
          <b>{responseLabel}</b>
          {periodContext.status === "published" ? <span><Link href={controller.sharePath}>View ballot</Link><Link href="/trends">See trends</Link></span> : null}
          {periodContext.status === "draft" ? <small>Continue the same saved list.</small> : null}
          {!periodContext.status && periodReady ? <small>Your first save opens this period&apos;s list.</small> : null}
        </div>
        {controller.periodLoadError ? <small className="rw-period-warning">Saved status could not sync. Your local draft is still available.</small> : null}
      </div>
      <div className="rw-mode-switch" aria-label="Workspace mode">
        <button
          type="button"
          className={mobileMode === "ranking" ? "is-active" : ""}
          aria-pressed={mobileMode === "ranking"}
          onClick={() => controller.setMobileMode("ranking")}
        >
          <span>YOUR RANKING</span>
          <strong>{history.present.length}/{template.defaultLength}</strong>
        </button>
        <button
          type="button"
          className={mobileMode === "analyze" ? "is-active" : ""}
          aria-pressed={mobileMode === "analyze"}
          onClick={() => controller.setMobileMode("analyze")}
        >
          <span>ANALYZE / COMPARE</span>
          <strong>{controller.candidates.length} eligible</strong>
        </button>
      </div>

      <div className="rw-toolbar-status">
        <div className="draft-status" role="status">
          <span className={saveState === "saving" ? "saving-dot" : "saved-dot"} />
          {saveLabel(saveState)}
        </div>
        <div className="rw-history-actions">
          <button type="button" onClick={controller.undo} disabled={!history.past.length} aria-label="Undo last ranking change">↶ <span>Undo</span></button>
          <button type="button" onClick={controller.redo} disabled={!history.future.length} aria-label="Redo last ranking change">↷ <span>Redo</span></button>
          <button
            type="button"
            className="publish-button"
            disabled={validationErrors.length > 0 || controller.isPeriodLocked}
            onClick={() => controller.setPublishOpen(true)}
          >
            {!periodReady ? "Checking period…" : periodContext.status === "published" ? "Submitted" : template.publishLabel}
          </button>
        </div>
      </div>
    </header>
  );
}
