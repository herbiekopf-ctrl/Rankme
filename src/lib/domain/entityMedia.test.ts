import { describe, expect, it } from "vitest";
import { auditCanonicalTeamMedia, resolveEntityMedia } from "./entityMedia";
import type { RankableEntity } from "./types";

function entity(overrides: Partial<RankableEntity> = {}): RankableEntity {
  return { id: "team:1", entityType: "team", name: "Alpha State", attributes: {}, ...overrides };
}

describe("entity media presentation", () => {
  it("distinguishes canonical team marks from related team context", () => {
    expect(resolveEntityMedia(entity({ imageUrl: "https://cdn.collegefootballdata.com/logos/1.png" }))).toMatchObject({
      kind: "image",
      role: "canonical-team-mark",
    });
    expect(resolveEntityMedia(entity({
      id: "stadium:1",
      entityType: "stadium",
      name: "Alpha Stadium",
      imageUrl: "https://cdn.collegefootballdata.com/logos/1.png",
      attributes: { team: "Alpha State" },
    }))).toMatchObject({ kind: "image", role: "related-team-mark", relatedEntityName: "Alpha State" });
  });

  it("provides an initials fallback", () => {
    expect(resolveEntityMedia(entity({ id: "town:athens", entityType: "town", name: "Athens" }))).toEqual({
      kind: "initials",
      role: "fallback",
      initials: "A",
      backgroundColor: undefined,
    });
  });

  it("detects missing and mismatched canonical team logo mappings", () => {
    expect(auditCanonicalTeamMedia([
      entity({ id: "team:1", imageUrl: "https://cdn.collegefootballdata.com/logos/1.png" }),
      entity({ id: "team:2", imageUrl: "https://cdn.collegefootballdata.com/logos/99.png" }),
      entity({ id: "team:3", imageUrl: undefined }),
      entity({ id: "stadium:4", entityType: "stadium", imageUrl: undefined }),
    ])).toEqual([
      { entityId: "team:2", reason: "canonical-logo-id-mismatch" },
      { entityId: "team:3", reason: "missing-image" },
    ]);
  });
});
