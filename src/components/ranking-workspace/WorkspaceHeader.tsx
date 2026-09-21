"use client";

import { votingDeadline } from "@/lib/domain/rankingPeriods";
import Link from "next/link";
import type { RankingWorkspaceController } from "@/hooks/useRankingWorkspace";

function saveLabel(state: RankingWorkspaceController["saveState"]) {
  if (state === "loading") return "Opening draft";
  if (state === "saving") return "Saving";
  if (state === "cloud") return "Saved to your account";
  if (state === "unsaved") return "Update not saved";
  return "Local draft saved";
}

export function WorkspaceHeader({ controller }: { controller: RankingWorkspaceController }) {
  const { history, mobileMode, periodContext, periodReady, saveState, template, validationErrors } = controller;
  const periodLabel = periodContext.responseCadence === "weekly"
    ? "YOU ARE VOTING FOR"
    : periodContext.responseCadence === "seasonal"
      ? "THIS SEASON"
      : "THIS POLL";
  const responseLabel = !periodReady
    ? "Checking…"
    : periodContext.status === "published"
      ? controller.editingPublished ? "Editing your vote" : "✓ Submitted"
      : periodContext.status === "draft"
        ? "Draft in progress"
        : "New ranking";

  return (
    <header className="rw-toolbar">
      <div className={`rw-period-strip ${periodContext.status ?? "not-started"}`}>
        <div className="rw-period-identity">
          <span>{periodLabel}</span>
          <strong>{periodContext.periodTitle}</strong>
          <small>{periodContext.season} season · {votingDeadline(periodContext) || "One vote per person"}</small>
        </div>
        <div className="rw-period-state">
          <b>{responseLabel}</b>
          {periodContext.status === "published" && !controller.editingPublished ? <span><Link href={controller.sharePath}>View ballot</Link><Link href="/rankings">See rankings</Link></span> : null}
          {controller.editingPublished ? <small>Your previous order stays in private revision history.</small> : null}
          {periodContext.status === "draft" ? <small>Continue the same saved list.</small> : null}
          {!periodContext.status && periodReady ? <small>Your first save opens this period&apos;s list.</small> : null}
        </div>
        {controller.periodLoadError ? <small className="rw-period-warning">Voting status is unavailable. Your draft stays on this device; submission requires a connection.</small> : null}
      </div>
      {controller.isPeriodLocked && periodReady ? <p role="status">This voting period is closed. <button type="button" onClick={() => window.location.reload()}>Open the current week</button></p> : null}
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
          <span>NEED HELP?</span>
          <strong>Stats & Live Model</strong>
        </button>
      </div>

      <div className="rw-toolbar-status">
        <div className="draft-status" role="status">
          <span className={saveState === "saving" ? "saving-dot" : "saved-dot"} />
          {controller.hasPublishedChanges ? "Unpublished changes · Save update to count your vote" : `${saveLabel(saveState)}${periodContext.status !== "published" ? " · Not submitted" : ""}`}
        </div>
        <div className="rw-history-actions">
          <button type="button" onClick={controller.undo} disabled={!history.past.length} aria-label="Undo last ranking change">↶ <span>Undo</span></button>
          <button type="button" onClick={controller.redo} disabled={!history.future.length} aria-label="Redo last ranking change">↷ <span>Redo</span></button>
          {controller.editingPublished ? <button type="button" className="rw-cancel-edit" onClick={controller.cancelPublishedEdit}>Cancel</button> : null}
          <button
            type="button"
            className="publish-button"
            disabled={!periodReady || (periodContext.status === "published"
              ? controller.editingPublished
                ? validationErrors.length > 0 || !controller.hasPublishedChanges
                : !controller.canRevisePublished
              : validationErrors.length > 0 || controller.isPeriodLocked)}
            onClick={() => {
              if (periodContext.status === "published" && !controller.editingPublished) controller.beginPublishedEdit();
              else controller.setPublishOpen(true);
            }}
          >
            {!periodReady
              ? "Checking period…"
              : periodContext.status === "published"
                ? controller.editingPublished ? "Save update" : periodContext.editable ? "Edit ranking" : "Period closed"
                : "Review & Submit"}
          </button>
        </div>
      </div>
    </header>
  );
}
