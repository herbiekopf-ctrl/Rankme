export type PreferenceBallot = {
  userId: string;
  templateId: string;
  placements: Array<{ entityId: string; position: number }>;
};

export type PreferenceProfile = {
  userId: string;
  dimensions: Record<string, string>;
};

export type AffinityResult = {
  suppressed: boolean;
  reason?: "small_anchor_cohort";
  sampleSize?: number;
  rankingPatterns: Array<{
    entityId: string;
    people: number;
    averagePosition: number;
    baselineAveragePosition: number;
    positionLift: number;
  }>;
  demographicPatterns: Array<{
    dimension: string;
    value: string;
    people: number;
    cohortShare: number;
    baselineShare: number;
    shareLift: number;
  }>;
};

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function analyzeRankingAffinity({
  profiles,
  ballots,
  filters = {},
  anchorTemplateId,
  anchorEntityId,
  anchorMaxPosition,
  compareTemplateId,
  minimumCohort = 25,
}: {
  profiles: PreferenceProfile[];
  ballots: PreferenceBallot[];
  filters?: Record<string, string>;
  anchorTemplateId: string;
  anchorEntityId: string;
  anchorMaxPosition: number;
  compareTemplateId: string;
  minimumCohort?: number;
}): AffinityResult {
  const privacyMinimum = Math.max(25, minimumCohort);
  const eligibleProfiles = profiles.filter((profile) => Object.entries(filters).every(([dimension, value]) => profile.dimensions[dimension] === value));
  const eligibleUsers = new Set(eligibleProfiles.map((profile) => profile.userId));
  const anchorUsers = new Set(ballots.filter((ballot) =>
    ballot.templateId === anchorTemplateId
    && eligibleUsers.has(ballot.userId)
    && ballot.placements.some((placement) => placement.entityId === anchorEntityId && placement.position <= anchorMaxPosition),
  ).map((ballot) => ballot.userId));
  if (anchorUsers.size < privacyMinimum) return { suppressed: true, reason: "small_anchor_cohort", rankingPatterns: [], demographicPatterns: [] };

  const compareBallots = ballots.filter((ballot) => ballot.templateId === compareTemplateId && eligibleUsers.has(ballot.userId));
  const baselineByEntity = new Map<string, number[]>();
  const anchorByEntity = new Map<string, number[]>();
  for (const ballot of compareBallots) for (const placement of ballot.placements) {
    const baseline = baselineByEntity.get(placement.entityId) ?? [];
    baseline.push(placement.position);
    baselineByEntity.set(placement.entityId, baseline);
    if (anchorUsers.has(ballot.userId)) {
      const anchor = anchorByEntity.get(placement.entityId) ?? [];
      anchor.push(placement.position);
      anchorByEntity.set(placement.entityId, anchor);
    }
  }
  const rankingPatterns = [...anchorByEntity.entries()].filter(([, positions]) => positions.length >= privacyMinimum).map(([entityId, positions]) => {
    const anchorAverage = average(positions);
    const baselineAverage = average(baselineByEntity.get(entityId) ?? positions);
    return { entityId, people: positions.length, averagePosition: anchorAverage, baselineAveragePosition: baselineAverage, positionLift: baselineAverage - anchorAverage };
  }).sort((a, b) => b.positionLift - a.positionLift);

  const baselineDimensionCounts = new Map<string, number>();
  const anchorDimensionCounts = new Map<string, number>();
  for (const profile of eligibleProfiles) for (const [dimension, value] of Object.entries(profile.dimensions)) {
    const key = `${dimension}:${value}`;
    baselineDimensionCounts.set(key, (baselineDimensionCounts.get(key) ?? 0) + 1);
    if (anchorUsers.has(profile.userId)) anchorDimensionCounts.set(key, (anchorDimensionCounts.get(key) ?? 0) + 1);
  }
  const demographicPatterns = [...anchorDimensionCounts.entries()].filter(([key, people]) => people >= privacyMinimum && (baselineDimensionCounts.get(key) ?? 0) >= privacyMinimum).map(([key, people]) => {
    const separator = key.indexOf(":");
    const dimension = key.slice(0, separator);
    const value = key.slice(separator + 1);
    const baselinePeople = baselineDimensionCounts.get(key) ?? 0;
    const cohortShare = people / anchorUsers.size;
    const baselineShare = baselinePeople / eligibleProfiles.length;
    return { dimension, value, people, cohortShare, baselineShare, shareLift: cohortShare - baselineShare };
  }).sort((a, b) => b.shareLift - a.shareLift);

  return { suppressed: false, sampleSize: anchorUsers.size, rankingPatterns, demographicPatterns };
}
