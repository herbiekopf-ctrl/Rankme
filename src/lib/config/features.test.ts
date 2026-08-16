import { describe, expect, it } from "vitest";
import { rankingWorkspaceVariant } from "./features";

describe("ranking workspace feature flag", () => {
  it("uses the unified workspace by default", () => {
    expect(rankingWorkspaceVariant(undefined)).toBe("unified");
    expect(rankingWorkspaceVariant("anything-else")).toBe("unified");
  });

  it("keeps the classic builder as an explicit rollback", () => {
    expect(rankingWorkspaceVariant("classic")).toBe("classic");
  });
});
