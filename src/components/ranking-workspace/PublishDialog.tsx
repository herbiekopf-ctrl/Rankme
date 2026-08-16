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
        <p className="kicker">BALLOT READY</p>
        <h2 id="publish-title">Your receipts are ready.</h2>
        <p>This share preview preserves the order and dataset version used for this draft.</p>
        <div className="publish-preview">
          {controller.rankedEntities.slice(0, 5).map((entity, index) => <span key={entity.id}><b>{index + 1}</b>{entity.name}</span>)}
          <em>+ {Math.max(0, controller.rankedEntities.length - 5)} more</em>
        </div>
        {controller.authReady && controller.canPublishRelational ? (
          <div className="publish-actions">
            <button type="button" className="button button-primary" disabled={controller.publishing} onClick={controller.publishRanking}>
              {controller.publishing ? "Publishing…" : "Publish relational ballot"}
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
