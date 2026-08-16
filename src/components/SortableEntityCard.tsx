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
  onDetails,
  disabled = false,
}: {
  entity: RankableEntity;
  rank: number;
  template: RankingTemplate;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onCompare?: () => void;
  onDetails?: () => void;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entity.id, disabled });
  const primary = template.visibleAttributes.slice(0, 2);
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`ranked-card${isDragging ? " is-dragging" : ""}${disabled ? " is-locked" : ""}`}
    >
      <button className="drag-handle" {...attributes} {...listeners} disabled={disabled} aria-label={`Drag ${entity.name} from rank ${rank}`}>⠿</button>
      <span className="rank-number">{rank}</span>
      <TeamMark entity={entity} />
      <div className="ranked-identity">
        <button className="ranked-name-button" onClick={onDetails} disabled={!onDetails}><strong>{entity.name}</strong></button>
        <div>{primary.map((key) => <span key={key}>{formatAttribute(entity.attributes[key])}</span>)}</div>
      </div>
      <div className="rank-controls" aria-label={`Move ${entity.name}`}>
        {onCompare && <button className="rank-compare" onClick={onCompare} aria-label={`Compare ${entity.name}`}>⇄</button>}
        <button onClick={() => onMove(-1)} disabled={disabled || rank === 1} aria-label={`Move ${entity.name} up`}>↑</button>
        <button onClick={() => onMove(1)} disabled={disabled || rank === template.maxLength} aria-label={`Move ${entity.name} down`}>↓</button>
        <button onClick={onRemove} disabled={disabled} aria-label={`Remove ${entity.name}`}>×</button>
      </div>
    </article>
  );
}
