import { describe, expect, it } from "vitest";
import { collegeFootballSeason, defaultResponseCadence, localRankingPeriod, periodIsOpen, recentWeeklyPeriods, responseStateLabel } from "./rankingPeriods";

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

  it("rolls over at Monday midnight Eastern, not midnight UTC", () => {
    const sunday = localRankingPeriod("weekly", 2026, new Date("2026-09-21T03:59:59Z"));
    const monday = localRankingPeriod("weekly", 2026, new Date("2026-09-21T04:00:00Z"));
    expect(sunday.periodSlug).toBe("2026-response-week-2026-09-14");
    expect(monday.periodSlug).toBe("2026-response-week-2026-09-21");
    expect(periodIsOpen(sunday, Date.parse(sunday.closesAt!))).toBe(false);
    expect(periodIsOpen(monday, Date.parse(monday.opensAt!))).toBe(true);
  });

  it("calculates real DST boundaries rather than assuming 168 hours", () => {
    const spring = localRankingPeriod("weekly", 2026, new Date("2026-03-08T16:00:00Z"));
    const fall = localRankingPeriod("weekly", 2026, new Date("2026-11-01T16:00:00Z"));
    expect((Date.parse(spring.closesAt!) - Date.parse(spring.opensAt!)) / 3600000).toBe(167);
    expect((Date.parse(fall.closesAt!) - Date.parse(fall.opensAt!)) / 3600000).toBe(169);
  });

  it("uses the previous football season in January and rolls over in July", () => {
    expect(collegeFootballSeason(new Date("2027-01-10T12:00:00Z"))).toBe(2026);
    expect(collegeFootballSeason(new Date("2027-07-01T12:00:00Z"))).toBe(2027);
  });

  it("never unlocks a closed or future period", () => {
    const context = localRankingPeriod("weekly", 2026, new Date("2026-09-19T12:00:00Z"));
    expect(periodIsOpen(context, Date.parse(context.opensAt!) - 1)).toBe(false);
    expect(periodIsOpen({ ...context, editable: false }, Date.parse(context.opensAt!))).toBe(false);
  });

  it("shows the last three actual weeks even when a week has no votes", () => {
    expect(recentWeeklyPeriods(2026, new Date("2026-09-20T12:00:00Z")).map(p => p.periodTitle)).toEqual([
      "Week of Aug 31–Sep 6", "Week of Sep 7–13", "Week of Sep 14–20",
    ]);
  });
});
