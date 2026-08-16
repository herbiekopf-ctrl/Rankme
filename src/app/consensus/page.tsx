import type { Metadata } from "next";
import { ConsensusExplorer } from "@/components/ConsensusExplorer";

export const metadata: Metadata = { title: "Browse polls", description: "Find recent and popular rankings, then submit your own." };

export default function ConsensusPage() {
  return <ConsensusExplorer />;
}
