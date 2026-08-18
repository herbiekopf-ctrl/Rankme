import { describe, expect, it } from "vitest";
import { buildUnlockedConsensusFilters } from "./browseConsensus";

describe("browse consensus profile filters", () => {
  const unlocked = [
    { id: "favorite", key: "favorite_entity", options: [
      { id: "clemson-id", value: "clemson-id" },
      { id: "georgia-id", value: "georgia-id" },
    ] },
    { id: "cohort:age", key: "age_band", options: [
      { id: "age-18-24", value: "18-24" },
      { id: "age-25-34", value: "25-34" },
    ] },
  ];

  it("allows any value inside a profile category the user completed", () => {
    expect(buildUnlockedConsensusFilters([
      { categoryId: "favorite", optionId: "georgia-id" },
      { categoryId: "cohort:age", optionId: "age-25-34" },
    ], unlocked)).toEqual({
      favorite_entity: "georgia-id",
      age_band: "25-34",
    });
  });

  it("rejects a category the user did not complete or a value outside its catalog", () => {
    expect(buildUnlockedConsensusFilters([
      { categoryId: "conference_fan", optionId: "acc-id" },
    ], unlocked)).toBeNull();
    expect(buildUnlockedConsensusFilters([
      { categoryId: "cohort:age", optionId: "unknown-age" },
    ], unlocked)).toBeNull();
  });

  it("rejects multiple values for one single-select category", () => {
    expect(buildUnlockedConsensusFilters([
      { categoryId: "cohort:age", optionId: "age-18-24" },
      { categoryId: "cohort:age", optionId: "age-25-34" },
    ], unlocked)).toBeNull();
  });
});
