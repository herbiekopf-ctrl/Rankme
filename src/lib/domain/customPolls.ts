import { isRankingSubject, rankableCategory } from "./rankableCatalog";
import type { CustomPollConfig, RankingTemplate } from "./types";

export function customPollEntityType(subject: CustomPollConfig["subject"]): string {
  return rankableCategory(subject).entityType;
}

export function customPollVisibleAttributes(subject: CustomPollConfig["subject"]): string[] {
  return rankableCategory(subject).visibleAttributes;
}

export function buildCustomTemplate(config: CustomPollConfig): RankingTemplate {
  const category = rankableCategory(config.subject);
  return {
    id: `custom-${config.id}`,
    version: 1,
    domain: "college-football",
    entityType: config.entityType,
    title: config.title,
    eyebrow: `${config.year} · Community question`,
    description: config.description?.trim() || `Rank ${config.length} ${category.label.toLocaleLowerCase()} in the order you believe is right. Every option comes from Ranked's saved data catalog.`,
    minLength: config.length,
    maxLength: config.length,
    exactLength: true,
    defaultLength: config.length,
    visibleAttributes: category.visibleAttributes,
    searchPlaceholder: `Search ${category.label.toLocaleLowerCase()}`,
    publishLabel: "Publish my ranking",
    accent: "#72d5c8",
  };
}

export function customDatasetUrl(config: CustomPollConfig): string {
  const params = new URLSearchParams({ year: String(config.year), subject: config.subject });
  for (const [key, value] of Object.entries(config.filters)) if (value && value !== "All") params.set(key, value);
  return `/api/college-football/rankables?${params}`;
}

export function encodeCustomPollConfig(config: CustomPollConfig): string {
  return encodeURIComponent(JSON.stringify(config));
}

export function decodeCustomPollConfig(raw: string | undefined): CustomPollConfig | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<CustomPollConfig>;
    if (
      typeof value.id !== "string"
      || typeof value.title !== "string"
      || typeof value.subject !== "string"
      || !isRankingSubject(value.subject)
      || typeof value.createdAt !== "string"
      || !Number.isInteger(value.length)
      || Number(value.length) < 2
      || Number(value.length) > 50
      || !Number.isInteger(value.year)
      || Number(value.year) < 2000
      || Number(value.year) > 2100
      || typeof value.filters !== "object"
      || value.filters === null
      || Array.isArray(value.filters)
    ) return null;
    const category = rankableCategory(value.subject);
    return {
      ...value,
      entityType: category.entityType,
      filters: Object.fromEntries(Object.entries(value.filters).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
    } as CustomPollConfig;
  } catch {
    return null;
  }
}
