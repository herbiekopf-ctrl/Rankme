"use client";

import type { RankingWorkspaceController } from "@/hooks/useRankingWorkspace";

export function MobileRankingTray({ controller }: { controller: RankingWorkspaceController }) {
  return (
    <nav className="rw-mobile-tray" aria-label="Ranking workspace">
      <button
        type="button"
        className={controller.mobileMode === "ranking" ? "is-active" : ""}
        aria-pressed={controller.mobileMode === "ranking"}
        onClick={() => controller.setMobileMode("ranking")}
      >
        <span>YOUR RANKING</span>
        <strong>{controller.history.present.length}/{controller.template.defaultLength}</strong>
      </button>
      <button
        type="button"
        className={controller.mobileMode === "analyze" ? "is-active" : ""}
        aria-pressed={controller.mobileMode === "analyze"}
        onClick={() => controller.setMobileMode("analyze")}
      >
        <span>NEED HELP?</span>
        <strong>Stats & Model</strong>
      </button>
    </nav>
  );
}
