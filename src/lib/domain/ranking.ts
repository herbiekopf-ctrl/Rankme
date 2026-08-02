import type { RankingTemplate } from "./types";

export function insertEntity(
  current: string[],
  entityId: string,
  position = current.length,
  maxLength = Number.POSITIVE_INFINITY,
): string[] {
  const withoutDuplicate = current.filter((id) => id !== entityId);
  const safePosition = Math.max(0, Math.min(position, withoutDuplicate.length));
  return [
    ...withoutDuplicate.slice(0, safePosition),
    entityId,
    ...withoutDuplicate.slice(safePosition),
  ].slice(0, maxLength);
}

export function moveEntity(current: string[], entityId: string, toIndex: number): string[] {
  if (!current.includes(entityId)) return current;
  return insertEntity(current, entityId, toIndex, current.length);
}

export function removeEntity(current: string[], entityId: string): string[] {
  return current.filter((id) => id !== entityId);
}

export function validateRanking(template: RankingTemplate, entityIds: string[]): string[] {
  const errors: string[] = [];
  if (new Set(entityIds).size !== entityIds.length) errors.push("Each item may appear only once.");
  if (entityIds.length < template.minLength) {
    errors.push(`Add ${template.minLength - entityIds.length} more item${template.minLength - entityIds.length === 1 ? "" : "s"}.`);
  }
  if (entityIds.length > template.maxLength) errors.push(`Remove ${entityIds.length - template.maxLength} items.`);
  if (template.exactLength && entityIds.length !== template.defaultLength) {
    errors.push(`This list must contain exactly ${template.defaultLength} items.`);
  }
  return [...new Set(errors)];
}

export function encodeRanking(entityIds: string[]): string {
  return entityIds.map(encodeURIComponent).join("~");
}

export function decodeRanking(encoded: string | null): string[] {
  if (!encoded) return [];
  return encoded.split("~").map(decodeURIComponent).filter(Boolean);
}
