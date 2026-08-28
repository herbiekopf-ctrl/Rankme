import type { Metadata } from "next";
import { ConsensusExplorer } from "@/components/ConsensusExplorer";

export const metadata: Metadata = { title: "Rankings", description: "See every consensus ranking, compare demographic groups, and adjust your own ballot." };

export default function RankingsPage() {
  return <ConsensusExplorer />;
}
