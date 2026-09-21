import type { Metadata } from "next";
import { ConsensusExplorer } from "@/components/ConsensusExplorer";

export const metadata: Metadata = { title: "Rankings", description: "See every consensus ranking, compare demographic groups, and adjust your own ballot." };

export default async function RankingsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const query = await searchParams;
  return <ConsensusExplorer initialView={query.view === "ap" ? "ap" : "community"} />;
}
