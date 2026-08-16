export type RankingHistoryState = {
  past: string[][];
  present: string[];
  future: string[][];
};

export type RankingHistoryAction =
  | { type: "hydrate"; entityIds: string[]; maxLength: number }
  | { type: "commit"; entityIds: string[] }
  | { type: "undo" }
  | { type: "redo" };

export const emptyRankingHistory: RankingHistoryState = { past: [], present: [], future: [] };

function sameOrder(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function rankingHistoryReducer(state: RankingHistoryState, action: RankingHistoryAction): RankingHistoryState {
  switch (action.type) {
    case "hydrate":
      return {
        past: [],
        present: [...new Set(action.entityIds)].slice(0, action.maxLength),
        future: [],
      };
    case "commit":
      if (sameOrder(state.present, action.entityIds)) return state;
      return {
        past: [...state.past, state.present].slice(-50),
        present: action.entityIds,
        future: [],
      };
    case "undo": {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      };
    }
    case "redo": {
      const next = state.future[0];
      if (!next) return state;
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
      };
    }
  }
}
