"use client";

import type { RankingWorkspaceController } from "@/hooks/useRankingWorkspace";

function saveLabel(state: RankingWorkspaceController["saveState"]) {
  if (state === "loading") return "Opening draft";
  if (state === "saving") return "Saving";
  if (state === "cloud") return "Relational draft saved";
  return "Local draft saved";
}

export function WorkspaceHeader({ controller }: { controller: RankingWorkspaceController }) {
  const { history, mobileMode, saveState, template, validationErrors } = controller;

  return (
    <header className="rw-toolbar">
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
            disabled={validationErrors.length > 0}
            onClick={() => controller.setPublishOpen(true)}
          >
            {template.publishLabel}
          </button>
        </div>
      </div>
    </header>
  );
}
