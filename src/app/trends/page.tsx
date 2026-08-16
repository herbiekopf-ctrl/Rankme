import type { Metadata } from "next";
import { RankingTrends } from "@/components/RankingTrends";

export const metadata: Metadata = { title: "Opinion trends" };

export default function TrendsPage() {
  return <RankingTrends />;
}
