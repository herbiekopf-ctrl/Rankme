import type { CustomPollConfig, DatasetEnvelope, RankableEntity, RankingTemplate } from "./types";

const SUBJECT_LABELS: Record<CustomPollConfig["subject"], string> = {
  teams: "FBS teams",
  "conference-teams": "conference schools",
  mascots: "mascots",
  towns: "college towns",
  stadiums: "stadiums",
  players: "players",
  manual: "your own options",
};

export function customPollEntityType(subject: CustomPollConfig["subject"]): string {
  if (subject === "teams" || subject === "conference-teams") return "team";
  if (subject === "manual") return "custom";
  if (subject === "players") return "player";
  return subject.slice(0, -1);
}

export function customPollVisibleAttributes(subject: CustomPollConfig["subject"]): string[] {
  switch (subject) {
    case "teams":
    case "conference-teams":
      return ["record", "conference", "lastResult", "nextOpponent"];
    case "mascots":
      return ["school", "conference"];
    case "towns":
      return ["state", "schools", "teamCount"];
    case "stadiums":
      return ["team", "city", "capacity"];
    case "players":
      return ["team", "position", "conference", "classYear"];
    default:
      return [];
  }
}

export function buildCustomTemplate(config: CustomPollConfig): RankingTemplate {
  return {
    id: `custom-${config.id}`,
    version: 1,
    domain: "college-football",
    entityType: customPollEntityType(config.subject),
    title: config.title,
    eyebrow: "Your custom poll",
    description: `Rank ${config.length} ${SUBJECT_LABELS[config.subject]} in the order you believe is right.`,
    minLength: config.length,
    maxLength: config.length,
    exactLength: true,
    defaultLength: config.length,
    visibleAttributes: customPollVisibleAttributes(config.subject),
    searchPlaceholder: `Search ${SUBJECT_LABELS[config.subject]}`,
    publishLabel: "Publish my poll",
    accent: "#72d5c8",
  };
}

export function customDatasetUrl(config: CustomPollConfig): string {
  const params = new URLSearchParams({ year: "2026", subject: config.subject });
  if (config.conference) params.set("conference", config.conference);
  if (config.position) params.set("position", config.position);
  return `/api/college-football/rankables?${params}`;
}

export function createManualDataset(config: CustomPollConfig): DatasetEnvelope {
  const entities: RankableEntity[] = (config.manualOptions ?? []).map((name, index) => ({
    id: `custom:${config.id}:${index}`,
    entityType: "custom",
    name,
    color: "#245a43",
    attributes: {},
  }));
  return {
    id: `manual-${config.id}`,
    version: `manual-${config.createdAt}`,
    source: "curated",
    sourceLabel: "Poll creator options",
    refreshedAt: config.createdAt,
    stale: false,
    connected: true,
    credentialConfigured: false,
    refreshMode: "fixture",
    entities,
  };
}

export function encodeCustomPollConfig(config: CustomPollConfig): string {
  return encodeURIComponent(JSON.stringify(config));
}

export function decodeCustomPollConfig(raw: string | undefined): CustomPollConfig | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<CustomPollConfig>;
    const subjects = new Set(["teams", "conference-teams", "mascots", "towns", "stadiums", "players", "manual"]);
    if (
      typeof value.id !== "string"
      || typeof value.title !== "string"
      || !value.subject
      || !subjects.has(value.subject)
      || typeof value.createdAt !== "string"
      || !Number.isInteger(value.length)
      || Number(value.length) < 2
      || Number(value.length) > 50
    ) return null;
    return value as CustomPollConfig;
  } catch {
    return null;
  }
}
