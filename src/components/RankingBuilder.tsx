"use client";

import { RankingWorkspace } from "./ranking-workspace/RankingWorkspace";
import type { CustomPollConfig, DatasetEnvelope, RankingTemplate } from "@/lib/domain/types";

export function RankingBuilder(props: {
  template: RankingTemplate;
  initialDataset: DatasetEnvelope;
  customConfig?: CustomPollConfig;
}) {
  return <RankingWorkspace {...props} />;
}
