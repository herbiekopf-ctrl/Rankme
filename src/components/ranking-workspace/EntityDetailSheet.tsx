"use client";

import { useEffect } from "react";
import { TeamMark } from "../TeamMark";
import type { RankingWorkspaceController } from "@/hooks/useRankingWorkspace";
import { formatAttribute } from "@/lib/utils";

export function EntityDetailSheet({ controller }: { controller: RankingWorkspaceController }) {
  const entity = controller.detailEntity;
  const setDetailId = controller.setDetailId;

  useEffect(() => {
    if (!entity) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setDetailId(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [entity, setDetailId]);

  if (!entity) return null;

  const rankIndex = controller.history.present.indexOf(entity.id);
  const isRanked = rankIndex >= 0;

  return (
    <div className="rw-sheet-backdrop" role="presentation" onMouseDown={() => controller.setDetailId(null)}>
      <aside
        className="rw-detail-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entity-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={() => controller.setDetailId(null)} aria-label="Close details">×</button>
        <div className="entity-detail-heading">
          <TeamMark entity={entity} size="large" />
          <div>
            <p className="kicker">CONTEXTUAL DETAIL</p>
            <h2 id="entity-detail-title">{entity.name}</h2>
            <span>{entity.entityType}{isRanked ? ` · ranked #${rankIndex + 1}` : " · eligible"}</span>
          </div>
        </div>
        <div className="entity-detail-grid rw-detail-grid">
          {Object.entries(entity.attributes)
            .filter(([, value]) => value !== null && value !== "")
            .map(([key, value]) => (
              <div key={key}>
                <span>{key.replace(/([a-z])([A-Z])/g, "$1 $2")}</span>
                <strong>{formatAttribute(value)}</strong>
              </div>
            ))}
        </div>
        <div className="entity-detail-actions rw-detail-actions">
          {controller.dataset.metricDefinitions?.length ? (
            <button type="button" className="button button-secondary" onClick={() => {
              controller.toggleCompare(entity.id);
              controller.setDetailId(null);
            }}>
              {controller.compareIds.includes(entity.id) ? "Selected for comparison" : "Add to comparison"}
            </button>
          ) : <span />}
          <button
            type="button"
            className="button button-primary"
            disabled={isRanked || controller.history.present.length >= controller.template.maxLength}
            onClick={() => {
              controller.addEntity(entity.id);
              controller.setDetailId(null);
            }}
          >
            {isRanked ? `Ranked #${rankIndex + 1}` : "Add to ranking"}
          </button>
        </div>
      </aside>
    </div>
  );
}
