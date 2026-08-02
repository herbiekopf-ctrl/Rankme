import type { Metadata } from "next";
import { CustomRankingLoader } from "@/components/CustomRankingLoader";

export const metadata: Metadata = { title: "Custom poll" };

export default async function CustomPollPage({ params }: { params: Promise<{ pollId: string }> }) {
  const { pollId } = await params;
  return <CustomRankingLoader pollId={pollId} />;
}
