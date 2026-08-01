import { describe, expect, it } from "vitest";
import { aggregateBallots, isCohortSuppressed } from "./consensus";

describe("consensus", () => {
  it("uses AP-style points and deterministic tie breakers", () => {
    const aggregate = aggregateBallots([
      ["a", "b", "c"],
      ["b", "a", "c"],
      ["a", "c", "b"],
    ], 3);
    expect(aggregate.map((position) => [position.entityId, position.points])).toEqual([
      ["a", 8],
      ["b", 6],
      ["c", 4],
    ]);
    expect(aggregate[0].firstPlaceVotes).toBe(2);
  });

  it("suppresses cohorts below the configured threshold", () => {
    expect(isCohortSuppressed(24)).toBe(true);
    expect(isCohortSuppressed(25)).toBe(false);
  });
});
