"use client";

import { ClassicRankingBuilder } from "./ClassicRankingBuilder";
import { RankingWorkspace } from "./ranking-workspace/RankingWorkspace";
import { rankingWorkspaceVariant } from "@/lib/config/features";
import type { CustomPollConfig, DatasetEnvelope, RankingTemplate } from "@/lib/domain/types";

export function RankingBuilder(props: {
  template: RankingTemplate;
  initialDataset: DatasetEnvelope;
  customConfig?: CustomPollConfig;
}) {
  return rankingWorkspaceVariant() === "classic"
    ? <ClassicRankingBuilder {...props} />
    : <RankingWorkspace {...props} />;
}
