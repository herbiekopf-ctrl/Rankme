"use client";

import { SignInGate } from "../SignInGate";
import type { RankingWorkspaceController } from "@/hooks/useRankingWorkspace";

export function PublishDialog({ controller }: { controller: RankingWorkspaceController }) {
  if (!controller.publishOpen) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => controller.setPublishOpen(false)}>
      <section className="publish-modal" role="dialog" aria-modal="true" aria-labelledby="publish-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={() => controller.setPublishOpen(false)} aria-label="Close">×</button>
        <span className="success-mark">✓</span>
        <p className="kicker">{controller.editingPublished ? "UPDATE READY" : "BALLOT READY"}</p>
        <h2 id="publish-title">{controller.editingPublished ? "Save this revision?" : "Your ranking is ready."}</h2>
        <p>{controller.editingPublished ? "This becomes your one active vote for the period. Your previous order stays in private revision history." : "This preview preserves the exact order and season context you used."}</p>
        <div className="publish-preview">
          {controller.rankedEntities.slice(0, 5).map((entity, index) => <span key={entity.id}><b>{index + 1}</b>{entity.name}</span>)}
          <em>+ {Math.max(0, controller.rankedEntities.length - 5)} more</em>
        </div>
        {controller.authReady && controller.canPublishRelational ? (
          <div className="publish-actions">
            <button type="button" className="button button-primary" disabled={controller.publishing} onClick={controller.publishRanking}>
              {controller.publishing ? controller.editingPublished ? "Saving…" : "Publishing…" : controller.editingPublished ? "Save update" : "Publish ranking"}
            </button>
            <button type="button" className="button button-secondary" onClick={controller.copyShareLink}>
              {controller.copied ? "Copied!" : "Copy preview link"}
            </button>
          </div>
        ) : controller.authReady ? <SignInGate /> : <div className="sign-in-receipt"><strong>Checking your account…</strong></div>}
        {controller.publishError && <p className="creator-error" role="alert">{controller.publishError}</p>}
      </section>
    </div>
  );
}
