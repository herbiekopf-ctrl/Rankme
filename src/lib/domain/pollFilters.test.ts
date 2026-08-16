import { describe, expect, it } from "vitest";
import { discoverCatalogFilters, mergeCatalogFilters } from "./pollFilters";
import type { RankableEntity } from "./types";

const teams: RankableEntity[] = [
  { id: "a", entityType: "team", name: "A", attributes: { conference: "ACC" } },
  { id: "b", entityType: "team", name: "B", attributes: { conference: "SEC" } },
];

describe("poll filter controls", () => {
  it("keeps a conference control editable after the filtered result narrows", () => {
    const initial = discoverCatalogFilters("teams", teams);
    const narrowed = discoverCatalogFilters("teams", teams.slice(0, 1));
    expect(mergeCatalogFilters(initial, narrowed)).toContainEqual({ key: "conference", label: "Conference", values: ["ACC", "SEC"] });
  });
});
