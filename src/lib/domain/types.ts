export type EntityAttributeValue = string | number | boolean | null;

export type RankableEntity = {
  id: string;
  externalIds?: Record<string, string>;
  entityType: string;
  name: string;
  shortName?: string;
  aliases?: string[];
  imageUrl?: string;
  color?: string;
  attributes: Record<string, EntityAttributeValue>;
};

export type AttributeDefinition = {
  key: string;
  label: string;
  kind: "text" | "number" | "record" | "result";
  freshness: "live" | "hourly" | "daily" | "weekly" | "seasonal" | "manual";
};

export type MetricDefinition = {
  key: string;
  label: string;
  description: string;
  format: "integer" | "decimal" | "percentage" | "signed";
  direction: "asc" | "desc";
};

export type RankingTemplate = {
  id: string;
  version: number;
  domain: string;
  entityType: string;
  title: string;
  eyebrow: string;
  description: string;
  minLength: number;
  maxLength: number;
  exactLength: boolean;
  defaultLength: number;
  visibleAttributes: string[];
  searchPlaceholder: string;
  publishLabel: string;
  accent: string;
};

export type DatasetEnvelope = {
  id: string;
  version: string;
  source: "collegefootballdata" | "seed" | "curated";
  sourceLabel: string;
  refreshedAt: string;
  stale: boolean;
  connected: boolean;
  credentialConfigured?: boolean;
  refreshMode?: "saved-snapshot" | "framework-cache" | "fixture";
  upstreamRequests?: number;
  warnings?: string[];
  metricDefinitions?: MetricDefinition[];
  entities: RankableEntity[];
};

export type RankingSubject =
  | "teams"
  | "conference-teams"
  | "mascots"
  | "towns"
  | "stadiums"
  | "players"
  | "manual";

export type CustomPollConfig = {
  id: string;
  title: string;
  subject: RankingSubject;
  length: number;
  conference?: string;
  position?: string;
  manualOptions?: string[];
  createdAt: string;
};

export type PollSubjectOption = {
  id: RankingSubject;
  label: string;
  description: string;
  count: number;
  available?: boolean;
};

export type PollCatalog = {
  year: number;
  connected: boolean;
  sourceLabel: string;
  refreshedAt: string;
  refreshMode: DatasetEnvelope["refreshMode"];
  upstreamRequests: number;
  warnings?: string[];
  conferences: string[];
  positions: string[];
  subjects: PollSubjectOption[];
};

export type RankingDraft = {
  id: string;
  templateId: string;
  templateVersion: number;
  datasetVersion: string;
  revision: number;
  entityIds: string[];
  updatedAt: string;
};

export type PublishedRanking = RankingDraft & {
  status: "published";
  publishedAt: string;
  title: string;
  note?: string;
  snapshot: Pick<DatasetEnvelope, "id" | "version" | "sourceLabel" | "refreshedAt">;
};
