import { describe, expect, it } from "vitest";
import { defaultResponseCadence, localRankingPeriod, responseStateLabel } from "./rankingPeriods";

describe("ranking periods", () => {
  it("uses a stable Monday-to-Sunday Eastern weekly identity", () => {
    const context = localRankingPeriod("weekly", 2026, new Date("2026-08-16T16:00:00Z"));
    expect(context.periodSlug).toBe("2026-response-week-2026-08-10");
    expect(context.periodTitle).toBe("Week of Aug 10–16");
  });

  it("distinguishes official weekly and custom one-time defaults", () => {
    expect(defaultResponseCadence("top-25")).toBe("weekly");
    expect(defaultResponseCadence("custom-example")).toBe("once");
    expect(defaultResponseCadence("custom-example", "seasonal")).toBe("seasonal");
  });

  it("labels saved response states directly", () => {
    const context = localRankingPeriod("once", 2026);
    expect(responseStateLabel(context)).toBe("Not started");
    expect(responseStateLabel({ ...context, status: "draft" })).toBe("Draft in progress");
    expect(responseStateLabel({ ...context, status: "published" })).toBe("Submitted");
  });
});
