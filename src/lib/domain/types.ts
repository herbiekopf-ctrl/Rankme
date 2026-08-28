export type EntityAttributeValue = string | number | boolean | null;

export type RankableEntity = {
  id: string;
  relationalId?: string;
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
  group?: "Resume" | "Scoring" | "Production" | "Efficiency" | "Power" | "Roster" | "History" | "Physical" | "Other";
  source?: string;
  unitLabel?: string;
  season?: number;
  context?: "current-season" | "prior-season" | "career" | "static";
  tier?: "core" | "advanced";
  entityType?: string;
  populatedEntityCount?: number;
  eligibleEntityCount?: number;
  coverage?: number;
  distinctValueCount?: number;
  available?: boolean;
  comparative?: boolean;
};

export type CustomMetricComponent = {
  metricKey: string;
  weight: number;
};

export type CustomMetricFormula = {
  version: 1;
  normalization: "percentile";
  components: CustomMetricComponent[];
};

export type UserCustomMetric = {
  id: string;
  userId: string;
  name: string;
  entityType: string;
  formula: CustomMetricFormula;
  visibility: "private" | "unlisted" | "public";
  creatorName?: string;
  createdAt: string;
  updatedAt: string;
};

export type EntityGameSnapshot = {
  id: string;
  week: number | null;
  date: string | null;
  opponent: string;
  opponentEntityId: string | null;
  opponentImageUrl: string | null;
  opponentColor: string | null;
  location: "home" | "away" | "neutral";
  completed: boolean;
  result: "W" | "L" | "T" | null;
  teamScore: number | null;
  opponentScore: number | null;
  scoreLabel: string;
  venue: string | null;
  difficultyScore: number | null;
  difficultyRank: number | null;
  difficultyFieldSize: number | null;
  difficultyLabel: "Elite" | "Tough" | "Even" | "Favorable" | "Easier" | null;
  difficultyMetric: string | null;
  difficultyMetricValue: number | null;
};

export type EntityAnalyticsSnapshot = {
  entityId: string;
  season: number;
  games: EntityGameSnapshot[];
  bestWin: EntityGameSnapshot | null;
  worstLoss: EntityGameSnapshot | null;
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
  source: "collegefootballdata" | "curated";
  sourceLabel: string;
  refreshedAt: string;
  stale: boolean;
  connected: boolean;
  credentialConfigured?: boolean;
  refreshMode?: "saved-snapshot" | "framework-cache";
  upstreamRequests?: number;
  warnings?: string[];
  metricDefinitions?: MetricDefinition[];
  entities: RankableEntity[];
};

export type RankingSubject =
  | "teams"
  | "players"
  | "coaches"
  | "conferences"
  | "games"
  | "stadiums"
  | "towns"
  | "mascots"
  | "recruiting-classes"
  | "recruits"
  | "transfers"
  | "units"
  | "team-seasons"
  | "draft-picks";

export type CatalogFilterDefinition = {
  key: string;
  label: string;
  values: string[];
  defaultValue?: string;
};

export type CustomPollConfig = {
  id: string;
  title: string;
  subject: RankingSubject;
  entityType: string;
  year: number;
  length: number;
  filters: Record<string, string>;
  description?: string;
  visibility?: "public" | "unlisted" | "private";
  rankingMethod?: "manual" | "pairwise" | "scoring" | "tier";
  responseCadence?: "once" | "weekly" | "seasonal";
  remoteTemplateId?: string;
  remoteTemplateVersionId?: string;
  createdAt: string;
};

export type PollSubjectOption = {
  id: RankingSubject;
  entityType: string;
  label: string;
  singularLabel: string;
  description: string;
  count: number;
  available?: boolean;
  group?: "People" | "Programs" | "Places" | "Competition" | "History" | "Culture";
  metricCount?: number;
  icon?: string;
  exampleQuestions?: string[];
  filters?: CatalogFilterDefinition[];
};

export type PollCatalog = {
  year: number;
  connected: boolean;
  sourceLabel: string;
  refreshedAt: string;
  refreshMode: DatasetEnvelope["refreshMode"];
  upstreamRequests: number;
  warnings?: string[];
  availableYears: number[];
  conferences: string[];
  positions: string[];
  subjects: PollSubjectOption[];
};

export type PlatformStatus = {
  databaseConfigured: boolean;
  schemaReady: boolean;
  serverWriteConfigured: boolean;
  projectRef?: string;
  tableCount: number;
  entityTypeCount: number;
  entityCount: number;
  activeDatasetVersion?: string;
  message: string;
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
