import { notFound } from "next/navigation";
import { RankingBuilder } from "@/components/RankingBuilder";
import { loadTeamDataset } from "@/lib/data/rankableDatasets";
import { seedStadiumDataset, seedTeamDataset } from "@/lib/domain/seed";
import { getTemplate } from "@/lib/domain/templates";

export default async function RankingPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  const template = getTemplate(templateId);
  if (!template) notFound();
  const dataset = template.entityType === "stadium"
    ? seedStadiumDataset()
    : template.entityType === "team"
      ? await loadTeamDataset(2026)
      : seedTeamDataset();
  return <RankingBuilder template={template} initialDataset={dataset} />;
}
