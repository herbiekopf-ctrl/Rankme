import { describe, expect, it } from "vitest";
import { buildOwnedConsensusFilters } from "./browseConsensus";

describe("browse consensus profile filters", () => {
  const owned = [
    { id: "favorite", key: "favorite_entity", value: "team-id" },
    { id: "conference_fan", key: "conference_affiliation", value: "conference-id" },
    { id: "cohort:region", key: "region", value: "south" },
  ];

  it("combines only filters owned by the current user", () => {
    expect(buildOwnedConsensusFilters(["favorite", "cohort:region"], owned)).toEqual({
      favorite_entity: "team-id",
      region: "south",
    });
  });

  it("rejects guessed or conflicting filters", () => {
    expect(buildOwnedConsensusFilters(["unknown"], owned)).toBeNull();
    expect(buildOwnedConsensusFilters(["first", "second"], [
      { id: "first", key: "region", value: "south" },
      { id: "second", key: "region", value: "west" },
    ])).toBeNull();
  });
});
