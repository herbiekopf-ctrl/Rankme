import { describe, expect, it } from "vitest";
import { analyzeRankingAffinity, type PreferenceBallot, type PreferenceProfile } from "./affinity";

function fixtures(count: number) {
  const profiles: PreferenceProfile[] = Array.from({ length: count }, (_, index) => ({ userId: `u${index}`, dimensions: { region: index < 30 ? "south" : "north", experience: index % 3 ? "avid" : "casual" } }));
  const ballots: PreferenceBallot[] = profiles.flatMap((profile, index) => [
    { userId: profile.userId, templateId: "teams", placements: [{ entityId: "clemson", position: index < 30 ? 3 : 12 }] },
    { userId: profile.userId, templateId: "coaches", placements: [{ entityId: "dabo", position: index < 30 ? 2 : 8 }] },
  ]);
  return { profiles, ballots };
}

describe("relational ranking affinity", () => {
  it("suppresses an anchor cohort below 25 users", () => {
    const { profiles, ballots } = fixtures(24);
    expect(analyzeRankingAffinity({ profiles, ballots, anchorTemplateId: "teams", anchorEntityId: "clemson", anchorMaxPosition: 5, compareTemplateId: "coaches" }).suppressed).toBe(true);
  });

  it("finds cross-poll and demographic lift without returning individual users", () => {
    const { profiles, ballots } = fixtures(60);
    const result = analyzeRankingAffinity({ profiles, ballots, anchorTemplateId: "teams", anchorEntityId: "clemson", anchorMaxPosition: 5, compareTemplateId: "coaches" });
    expect(result.suppressed).toBe(false);
    expect(result.sampleSize).toBe(30);
    expect(result.rankingPatterns[0]).toMatchObject({ entityId: "dabo", people: 30, positionLift: 3 });
    expect(result.demographicPatterns[0]).toMatchObject({ dimension: "region", value: "south", people: 30 });
    expect(JSON.stringify(result)).not.toContain("u0");
  });
});
