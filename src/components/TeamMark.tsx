import type { RankableEntity } from "@/lib/domain/types";

export function TeamMark({ entity, size = "medium" }: { entity: RankableEntity; size?: "small" | "medium" | "large" }) {
  if (entity.imageUrl) {
    return <span className={`entity-mark mark-${size}`} style={{ background: entity.color }}>
      {/* Provider logo hosts vary; upstream images are already tiny and intentionally bypass Next image proxying. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={entity.imageUrl} alt="" />
    </span>;
  }
  const initials = entity.shortName ?? entity.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 3);
  return <span className={`entity-mark mark-${size}`} style={{ background: entity.color }}>{initials.slice(0, 3)}</span>;
}
