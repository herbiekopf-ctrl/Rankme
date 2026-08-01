import type { RankingTemplate } from "./types";

export const rankingTemplates: Record<string, RankingTemplate> = {
  "top-25": {
    id: "top-25",
    version: 1,
    domain: "college-football",
    entityType: "team",
    title: "Your 2026 Preseason Top 25",
    eyebrow: "The Sunday ballot",
    description: "Rank the teams you believe are best right now. The data informs your call—it never makes it for you.",
    minLength: 25,
    maxLength: 25,
    exactLength: true,
    defaultLength: 25,
    visibleAttributes: ["record", "conference", "lastResult", "nextOpponent"],
    searchPlaceholder: "Search school, nickname, or conference",
    publishLabel: "Publish my ballot",
    accent: "#f4b942",
  },
  stadiums: {
    id: "stadiums",
    version: 1,
    domain: "college-football",
    entityType: "stadium",
    title: "Best College Football Stadiums",
    eyebrow: "Rank anything CFB",
    description: "Build your ten-place stadium list using the exact same ranking engine as the Top 25.",
    minLength: 10,
    maxLength: 10,
    exactLength: true,
    defaultLength: 10,
    visibleAttributes: ["team", "city", "capacity"],
    searchPlaceholder: "Search stadium, team, or city",
    publishLabel: "Publish stadium list",
    accent: "#72d5c8",
  },
};

export function getTemplate(id: string): RankingTemplate | null {
  return rankingTemplates[id] ?? null;
}
