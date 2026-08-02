import type { EntityAttributeValue, RankableEntity } from "./domain/types";

export function formatAttribute(value: EntityAttributeValue): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return new Intl.NumberFormat("en-US").format(value);
  return value;
}

export function entityMatches(entity: RankableEntity, rawQuery: string): boolean {
  const query = rawQuery.trim().toLocaleLowerCase();
  if (!query) return true;
  const values = [
    entity.name,
    entity.shortName,
    ...(entity.aliases ?? []),
    ...Object.values(entity.attributes).map(String),
  ];
  return values.some((value) => value?.toLocaleLowerCase().includes(query));
}

export function timeAgo(iso: string): string {
  const difference = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.round(difference / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
