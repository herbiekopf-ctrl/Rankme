import { describe, expect, it } from "vitest";
import { browsePollHref, participatedPolls, popularPolls, recentPolls, type BrowsePoll } from "./browsePolls";

function poll(overrides: Partial<BrowsePoll>): BrowsePoll {
  return {
    id: "poll-1",
    slug: "community-poll-1",
    title: "Poll",
    description: null,
    creatorName: "Ranked member",
    templateKind: "community",
    templateVersionId: "version-1",
    cycleId: "cycle-1",
    entityType: "team",
    length: 10,
    maxLength: 10,
    datasetVersionId: "dataset-1",
    editable: true,
    createdAt: "2026-08-01T00:00:00.000Z",
    lastResponseAt: null,
    responseCount: 0,
    selectedResponseCount: 0,
    consensusSuppressed: false,
    minimumCohort: 1,
    responseCadence: "once",
    periodTitle: "One-time poll",
    myResponseStatus: null,
    preview: [],
    ...overrides,
  };
}

describe("browse polls", () => {
  it("routes official and community polls to usable ranking workspaces", () => {
    expect(browsePollHref(poll({ slug: "official-top-25", templateKind: "official" }))).toBe("/rank/top-25");
    expect(browsePollHref(poll({ id: "community-id" }))).toBe("/rank/custom/community-id");
  });

  it("orders recent polls by activity and popular polls by response count", () => {
    const quiet = poll({ id: "quiet", createdAt: "2026-08-15T00:00:00.000Z", responseCount: 1 });
    const active = poll({ id: "active", lastResponseAt: "2026-08-16T00:00:00.000Z", responseCount: 3 });
    expect(recentPolls([quiet, active]).map((item) => item.id)).toEqual(["active", "quiet"]);
    expect(popularPolls([quiet, active]).map((item) => item.id)).toEqual(["active", "quiet"]);
  });

  it("keeps only polls the current user has started in their strip", () => {
    const untouched = poll({ id: "untouched" });
    const submitted = poll({ id: "submitted", myResponseStatus: "published" });
    const draft = poll({ id: "draft", myResponseStatus: "draft" });
    expect(participatedPolls([untouched, submitted, draft]).map((item) => item.id).sort()).toEqual(["draft", "submitted"]);
  });
});
