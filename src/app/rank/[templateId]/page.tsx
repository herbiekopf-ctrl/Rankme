import { collegeFootballSeason } from "@/lib/domain/rankingPeriods";
import { notFound } from "next/navigation";
import { RankingBuilder } from "@/components/RankingBuilder";
import { loadRankableDataset, loadTeamDataset } from "@/lib/data/rankableDatasets";
import { getTemplate } from "@/lib/domain/templates";

export default async function RankingPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  const template = getTemplate(templateId);
  if (!template) notFound();
  const dataset = template.entityType === "stadium"
    ? await loadRankableDataset(collegeFootballSeason(), "stadiums")
    : template.entityType === "team"
      ? await loadTeamDataset(collegeFootballSeason())
      : await loadRankableDataset(collegeFootballSeason(), "teams");
  return <RankingBuilder template={template} initialDataset={dataset} />;
}
