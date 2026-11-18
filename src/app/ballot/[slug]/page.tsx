import type { Metadata } from "next";
import { PublishedBallot } from "@/components/PublishedBallot";
import { decodeRanking } from "@/lib/domain/ranking";

export const metadata: Metadata = {
  title: "College Football Ballot",
  description: "A fan-built college football ranking on Ranked.",
};

export default async function BallotPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ teams?: string; items?: string; template?: string; config?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  return <PublishedBallot slug={slug} entityIds={decodeRanking(query.items ?? query.teams ?? null)} templateId={query.template ?? "top-25"} customConfigRaw={query.config} />;
}
