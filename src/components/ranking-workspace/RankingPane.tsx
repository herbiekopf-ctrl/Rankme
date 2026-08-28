"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SortableEntityCard } from "../SortableEntityCard";
import type { RankingWorkspaceController } from "@/hooks/useRankingWorkspace";

export function RankingPane({ controller }: { controller: RankingWorkspaceController }) {
  const { history, rankedEntities, remaining, template } = controller;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    if (controller.isPeriodLocked) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const toIndex = history.present.indexOf(String(over.id));
    if (toIndex >= 0) controller.moveRankedEntity(String(active.id), toIndex);
  }

  return (
    <section
      className={`rw-pane rw-ranking-pane${controller.mobileMode === "ranking" ? " is-mobile-active" : ""}`}
      aria-labelledby="your-ranking-heading"
      data-workspace-pane="ranking"
    >
      <div className="rw-pane-heading rw-ranking-heading">
        <div>
          <span>YOUR RANKING</span>
          <h2 id="your-ranking-heading">{history.present.length} of {template.defaultLength} ranked</h2>
        </div>
        <div
          className="completion-ring"
          style={{ "--progress": `${Math.min(1, history.present.length / template.defaultLength) * 360}deg` } as React.CSSProperties}
          aria-label={`${history.present.length} of ${template.defaultLength} positions filled`}
        >
          <span>{history.present.length}</span>
        </div>
      </div>

      <div className="rw-pane-body" data-scroll-region="ranking">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={history.present} strategy={verticalListSortingStrategy}>
            <div className="ranking-list">
              {rankedEntities.map((entity, index) => (
                <SortableEntityCard
                  key={entity.id}
                  entity={entity}
                  rank={index + 1}
                  template={template}
                  onMove={(direction) => controller.moveRankedEntity(entity.id, index + direction)}
                  onRemove={() => controller.removeRankedEntity(entity.id)}
                  onDetails={() => controller.setDetailId(entity.id)}
                  focused={controller.focusedRankId === entity.id}
                  disabled={controller.isPeriodLocked}
                />
              ))}
              {Array.from({ length: Math.min(remaining, history.present.length ? 3 : 5) }, (_, index) => (
                <div className="empty-rank" key={history.present.length + index + 1}>
                  <span>{history.present.length + index + 1}</span>
                  <p>{history.present.length ? "Drop or add the next pick" : "Add a team from Rank by Metric"}</p>
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>
        {remaining > 3 && history.present.length > 0 && <p className="remaining-note">+ {remaining - 3} more open spots</p>}
      </div>
    </section>
  );
}
