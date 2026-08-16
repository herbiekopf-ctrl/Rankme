import type { RankableEntity } from "./types";

export type EntityMediaPresentation = {
  kind: "image" | "initials";
  role: "canonical-team-mark" | "related-team-mark" | "fallback";
  imageUrl?: string;
  initials: string;
  backgroundColor?: string;
  relatedEntityName?: string;
};

export type TeamMediaAuditIssue = {
  entityId: string;
  reason: "missing-image" | "canonical-logo-id-mismatch";
};

const CANONICAL_TEAM_MARK_TYPES = new Set(["team", "team-season"]);

function initials(entity: RankableEntity): string {
  const value = entity.shortName ?? entity.name.split(/\s+/).map((part) => part[0]).join("");
  return value.slice(0, 3).toLocaleUpperCase();
}

function relatedTeamName(entity: RankableEntity): string | undefined {
  for (const key of ["team", "school", "committedTo", "destination", "collegeTeam", "origin"]) {
    const value = entity.attributes[key];
    if (typeof value === "string" && value.trim() && value !== "Uncommitted") return value;
  }
  return undefined;
}

export function resolveEntityMedia(entity: RankableEntity): EntityMediaPresentation {
  const fallback = initials(entity);
  if (!entity.imageUrl) {
    return { kind: "initials", role: "fallback", initials: fallback, backgroundColor: entity.color };
  }
  if (CANONICAL_TEAM_MARK_TYPES.has(entity.entityType)) {
    return { kind: "image", role: "canonical-team-mark", imageUrl: entity.imageUrl, initials: fallback, backgroundColor: entity.color };
  }
  return {
    kind: "image",
    role: "related-team-mark",
    imageUrl: entity.imageUrl,
    initials: fallback,
    backgroundColor: entity.color,
    relatedEntityName: relatedTeamName(entity),
  };
}

export function auditCanonicalTeamMedia(entities: RankableEntity[]): TeamMediaAuditIssue[] {
  return entities.flatMap<TeamMediaAuditIssue>((entity) => {
    if (entity.entityType !== "team") return [];
    if (!entity.imageUrl) return [{ entityId: entity.id, reason: "missing-image" as const }];
    const canonicalId = entity.id.match(/^team:(\d+)$/)?.[1];
    const logoId = entity.imageUrl.match(/\/logos\/(\d+)(?:\.[a-z]+)?(?:\?|$)/i)?.[1];
    if (canonicalId && logoId && canonicalId !== logoId) {
      return [{ entityId: entity.id, reason: "canonical-logo-id-mismatch" as const }];
    }
    return [];
  });
}
