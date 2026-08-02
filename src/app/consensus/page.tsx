import type { Metadata } from "next";
import { ConsensusExplorer } from "@/components/ConsensusExplorer";

export const metadata: Metadata = { title: "Fan Consensus" };

export default function ConsensusPage() {
  return <ConsensusExplorer />;
}
