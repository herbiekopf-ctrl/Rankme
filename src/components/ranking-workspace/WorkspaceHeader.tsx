"use client";

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
    ? "THIS WEEK"
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
          <small>One vote per person. Revise it while this period is open.</small>
        </div>
        <div className="rw-period-state">
          <b>{responseLabel}</b>
          {periodContext.status === "published" && !controller.editingPublished ? <span><Link href={controller.sharePath}>View ballot</Link><Link href="/rankings">See rankings</Link></span> : null}
          {controller.editingPublished ? <small>Your previous order stays in private revision history.</small> : null}
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
          <span>RANK BY METRIC</span>
          <strong>{controller.metricEntities.length} teams</strong>
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
                : template.publishLabel}
          </button>
        </div>
      </div>
    </header>
  );
}
