export type RankingWorkspaceVariant = "classic" | "unified";

export function rankingWorkspaceVariant(value = process.env.NEXT_PUBLIC_RANKING_WORKSPACE_VARIANT): RankingWorkspaceVariant {
  return value === "classic" ? "classic" : "unified";
}
