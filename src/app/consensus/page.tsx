import type { Metadata } from "next";
import { ConsensusExplorer } from "@/components/ConsensusExplorer";

export const metadata: Metadata = { title: "Browse consensus", description: "See community consensus, filter it by your profile, and add or revise your ranking." };

export default function ConsensusPage() {
  return <ConsensusExplorer />;
}
