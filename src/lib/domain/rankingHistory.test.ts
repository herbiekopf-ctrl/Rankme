import { describe, expect, it } from "vitest";
import { emptyRankingHistory, rankingHistoryReducer } from "./rankingHistory";

describe("ranking history", () => {
  it("hydrates a deduplicated, bounded draft without inventing history", () => {
    expect(rankingHistoryReducer(emptyRankingHistory, {
      type: "hydrate",
      entityIds: ["a", "b", "a", "c"],
      maxLength: 2,
    })).toEqual({ past: [], present: ["a", "b"], future: [] });
  });

  it("treats each committed order as one undoable event", () => {
    const first = rankingHistoryReducer(emptyRankingHistory, { type: "commit", entityIds: ["a"] });
    const second = rankingHistoryReducer(first, { type: "commit", entityIds: ["b", "a"] });
    const undone = rankingHistoryReducer(second, { type: "undo" });
    expect(undone.present).toEqual(["a"]);
    expect(rankingHistoryReducer(undone, { type: "redo" }).present).toEqual(["b", "a"]);
  });

  it("does not add history for an unchanged order", () => {
    const state = { past: [], present: ["a"], future: [] };
    expect(rankingHistoryReducer(state, { type: "commit", entityIds: ["a"] })).toBe(state);
  });
});
