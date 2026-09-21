import { describe, expect, it } from "vitest";
import { apGridPath, parseApPoll } from "./apPoll";

// Synthetic parser fixtures, deliberately independent of real voters or results.
const header = 'Week 2 AP Poll (Sep 13, 2026)';
const list = header + '<a href="/football/grid/2026/week-2">Grid</a>' + Array.from({ length: 25 }, (_, i) =>
  `<div class="teamBar"><span class="teamRank">${i + 1}</span><img class="teamLogo" src="//images.collegepolltracker.com/logos/t${i}.png"/><span class="teamName"><a href="/football/team/t${i}/2026">Team ${i}</a><span class="teamFirst"><b>(${i === 0 ? 1 : 0})</b></span><span class="teamPoints"><b>${25 - i}</b></span></div>`).join("");
const ballot = '<div class="gridRow"><div class="gridPollster"><a href="/football/pollster/test/2026/week-2">Test Voter</a><span class="gridPollsterAffiliation">Test outlet</span></div>' + Array.from({ length: 25 }, (_, i) => `<div class="gridTeam gi_t${i}"></div>`).join("");

describe("AP ballot source integrity", () => {
  it("only exposes ballots that reproduce the published totals", () => {
    const result = parseApPoll(list, header + ballot);
    expect(result.ballotsVerified).toBe(true);
    expect(result.ballots[0].teamIds).toHaveLength(25);
    expect(result.week).toBe("Week 2");
    expect(result.season).toBe(2026);
  });
  it("keeps aggregate results but hides mismatched or incomplete ballots", () => {
    for (const grid of ["", header.replace("Sep 13", "Sep 6") + ballot, header + ballot.replace("gi_t0", "gi_t1"), header + ballot + ballot]) {
      const result = parseApPoll(list, grid);
      expect(result.teams).toHaveLength(25);
      expect(result.ballotsVerified).toBe(false);
      expect(result.ballots).toEqual([]);
    }
  });
  it("rejects ballot totals that differ from the published poll", () => {
    expect(parseApPoll(list.replace('<b>25</b>', '<b>26</b>'), header + ballot).ballotsVerified).toBe(false);
  });
  it("ignores an explicitly empty non-voter row", () => {
    const blank = ballot.replaceAll(/gi_t\d+/g, "gi_blank").replace("pollster/test/", "pollster/absent/");
    expect(parseApPoll(list, header + ballot + blank).ballots).toHaveLength(1);
  });
  it("never turns source markup into arbitrary fetch URLs", () => {
    expect(apGridPath(list)).toBe("https://collegepolltracker.com/football/grid/2026/week-2");
    expect(() => apGridPath('<a href="https://example.com/secret">')).toThrow();
    expect(() => parseApPoll("<html>unavailable</html>", "")).toThrow();
  });
});
