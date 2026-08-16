"use client";

import { getBrowserSupabaseClient, requirePermanentRankedUser } from "./browser";

export type SavedRankingPlacement = { position: number; name: string; imageUrl: string | null; color: string | null };
export type SavedRankingHistory = {
  id: string; title: string; status: "draft" | "published"; visibility: string; revision: number;
  createdAt: string; updatedAt: string; publishedAt: string | null; placements: SavedRankingPlacement[];
};

export async function loadMyRankingHistory(): Promise<SavedRankingHistory[]> {
  const client = getBrowserSupabaseClient();
  if (!client) return [];
  const user = await requirePermanentRankedUser(client);
  const { data: rankings, error } = await client.from("rankings").select("id,title,status,visibility,revision,created_at,updated_at,published_at").eq("author_id", user.id).in("status", ["draft", "published"]).order("updated_at", { ascending: false });
  if (error) throw error;
  const ids = rankings.map((ranking) => ranking.id);
  if (!ids.length) return [];
  const { data: placements, error: placementError } = await client.from("ranking_placements").select("ranking_id,position,entities(name,image_url,color)").in("ranking_id", ids).order("position");
  if (placementError) throw placementError;
  const byRanking = new Map<string, SavedRankingPlacement[]>();
  for (const placement of placements) {
    const entity = Array.isArray(placement.entities) ? placement.entities[0] : placement.entities;
    if (!entity) continue;
    const list = byRanking.get(placement.ranking_id) ?? [];
    list.push({ position: placement.position, name: entity.name, imageUrl: entity.image_url, color: entity.color });
    byRanking.set(placement.ranking_id, list);
  }
  return rankings.map((ranking) => ({
    id: ranking.id, title: ranking.title ?? "Untitled ranking", status: ranking.status as "draft" | "published", visibility: ranking.visibility,
    revision: ranking.revision, createdAt: ranking.created_at, updatedAt: ranking.updated_at, publishedAt: ranking.published_at,
    placements: byRanking.get(ranking.id) ?? [],
  }));
}
