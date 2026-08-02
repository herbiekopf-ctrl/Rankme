"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TeamMark } from "./TeamMark";
import type { RankableEntity, RankingTemplate } from "@/lib/domain/types";
import { formatAttribute } from "@/lib/utils";

export function SortableEntityCard({
  entity,
  rank,
  template,
  onMove,
  onRemove,
  onCompare,
}: {
  entity: RankableEntity;
  rank: number;
  template: RankingTemplate;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onCompare?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entity.id });
  const primary = template.visibleAttributes.slice(0, 2);
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`ranked-card${isDragging ? " is-dragging" : ""}`}
    >
      <button className="drag-handle" {...attributes} {...listeners} aria-label={`Drag ${entity.name} from rank ${rank}`}>⠿</button>
      <span className="rank-number">{rank}</span>
      <TeamMark entity={entity} />
      <div className="ranked-identity">
        <strong>{entity.name}</strong>
        <div>{primary.map((key) => <span key={key}>{formatAttribute(entity.attributes[key])}</span>)}</div>
      </div>
      <div className="rank-controls" aria-label={`Move ${entity.name}`}>
        {onCompare && <button className="rank-compare" onClick={onCompare} aria-label={`Compare ${entity.name}`}>⇄</button>}
        <button onClick={() => onMove(-1)} disabled={rank === 1} aria-label={`Move ${entity.name} up`}>↑</button>
        <button onClick={() => onMove(1)} disabled={rank === template.maxLength} aria-label={`Move ${entity.name} down`}>↓</button>
        <button onClick={onRemove} aria-label={`Remove ${entity.name}`}>×</button>
      </div>
    </article>
  );
}
