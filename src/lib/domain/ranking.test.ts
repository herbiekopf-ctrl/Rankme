import { describe, expect, it } from "vitest";
import { decodeRanking, encodeRanking, insertEntity, moveEntity, removeEntity, validateRanking } from "./ranking";
import { rankingTemplates } from "./templates";

describe("ranking operations", () => {
  it("inserts without creating duplicates", () => {
    expect(insertEntity(["a", "b", "c"], "b", 0)).toEqual(["b", "a", "c"]);
  });

  it("moves and removes entities deterministically", () => {
    expect(moveEntity(["a", "b", "c"], "a", 2)).toEqual(["b", "c", "a"]);
    expect(removeEntity(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });

  it("enforces an exact Top 25", () => {
    expect(validateRanking(rankingTemplates["top-25"], Array.from({ length: 24 }, (_, index) => String(index)))).toContain("This list must contain exactly 25 items.");
    expect(validateRanking(rankingTemplates["top-25"], Array.from({ length: 25 }, (_, index) => String(index)))).toEqual([]);
  });

  it("round trips share URLs", () => {
    const ids = ["team:1", "team:Texas A&M", "team:3"];
    expect(decodeRanking(encodeRanking(ids))).toEqual(ids);
  });
});
