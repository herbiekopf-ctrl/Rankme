import { describe, expect, it } from "vitest";
import { buildUnlockedConsensusFilters } from "./browseConsensus";

describe("browse consensus profile filters", () => {
  const available = [
    { id: "favorite:clemson", key: "favorite_entity", value: "clemson" },
    { id: "favorite:georgia", key: "favorite_entity", value: "georgia" },
    { id: "conference_fan:acc", key: "conference_affiliation", value: "acc" },
    { id: "conference_fan:sec", key: "conference_affiliation", value: "sec" },
    { id: "cohort:age:25-34", key: "age", value: "25-34" },
    { id: "cohort:age:35-44", key: "age", value: "35-44" },
  ];

  it("allows any value inside categories unlocked by the current user", () => {
    expect(buildUnlockedConsensusFilters(["favorite:georgia", "cohort:age:35-44"], available)).toEqual({
      favorite_entity: "georgia",
      age: "35-44",
    });
  });

  it("rejects guessed or conflicting filters", () => {
    expect(buildUnlockedConsensusFilters(["unknown"], available)).toBeNull();
    expect(buildUnlockedConsensusFilters(["first", "second"], [
      { id: "first", key: "region", value: "south" },
      { id: "second", key: "region", value: "west" },
    ])).toBeNull();
  });
});
