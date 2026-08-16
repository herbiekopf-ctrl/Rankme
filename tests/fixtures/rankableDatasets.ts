import type { CustomPollConfig, DatasetEnvelope } from "../../src/lib/domain/types";

const refreshedAt = "2026-08-15T22:25:58.781Z";

export const teamPollConfig = {
  id: "phase0-team",
  title: "Phase 0 Team Ranking",
  subject: "teams",
  entityType: "team",
  year: 2026,
  length: 3,
  filters: {},
  createdAt: refreshedAt,
} satisfies CustomPollConfig;

export const teamDataset = {
  id: "fixture-team-2026",
  version: "cfbd-2026-fixture",
  source: "collegefootballdata",
  sourceLabel: "Phase 0 fixture",
  refreshedAt,
  stale: false,
  connected: true,
  credentialConfigured: true,
  refreshMode: "saved-snapshot",
  upstreamRequests: 19,
  metricDefinitions: [
    { key: "fpi", label: "FPI", description: "Football Power Index.", format: "signed", direction: "desc", group: "Power", tier: "core", entityType: "team", populatedEntityCount: 4, eligibleEntityCount: 4, coverage: 1, distinctValueCount: 4, available: true, comparative: true },
    { key: "spOverall", label: "SP+ overall", description: "Overall SP+ rating.", format: "signed", direction: "desc", group: "Power", tier: "core", entityType: "team", populatedEntityCount: 4, eligibleEntityCount: 4, coverage: 1, distinctValueCount: 4, available: true, comparative: true },
  ],
  entities: [
    { id: "team:1", entityType: "team", name: "Alpha State", shortName: "ASU", imageUrl: "https://cdn.collegefootballdata.com/logos/1.png", color: "#17365d", attributes: { record: "0-0", conference: "Atlantic", fpi: 18.2, spOverall: 21.5, lastResult: "Preseason", nextOpponent: "Beta" } },
    { id: "team:2", entityType: "team", name: "Beta Tech", shortName: "BT", color: "#772f40", attributes: { record: "0-0", conference: "Atlantic", fpi: 12.4, spOverall: 15.8, lastResult: "Preseason", nextOpponent: "Alpha" } },
    { id: "team:3", entityType: "team", name: "Gamma University", shortName: "GU", color: "#154734", attributes: { record: "0-0", conference: "Central", fpi: 7.9, spOverall: 11.1, lastResult: "Preseason", nextOpponent: "Delta" } },
    { id: "team:4", entityType: "team", name: "Delta College", shortName: "DC", color: "#7a0019", attributes: { record: "0-0", conference: "Central", fpi: 2.3, spOverall: 5.2, lastResult: "Preseason", nextOpponent: "Gamma" } },
  ],
} satisfies DatasetEnvelope;

export const stadiumPollConfig = {
  id: "phase0-stadium",
  title: "Phase 0 Stadium Ranking",
  subject: "stadiums",
  entityType: "stadium",
  year: 2026,
  length: 2,
  filters: {},
  createdAt: refreshedAt,
} satisfies CustomPollConfig;

export const stadiumDataset = {
  id: "fixture-stadium-2026",
  version: "cfbd-2026-fixture",
  source: "collegefootballdata",
  sourceLabel: "Phase 0 fixture",
  refreshedAt,
  stale: false,
  connected: true,
  refreshMode: "saved-snapshot",
  upstreamRequests: 19,
  metricDefinitions: [
    { key: "capacity", label: "Capacity", description: "Official capacity.", format: "integer", direction: "desc", group: "Physical", tier: "core", entityType: "stadium", populatedEntityCount: 3, eligibleEntityCount: 3, coverage: 1, distinctValueCount: 3, available: true, comparative: true },
    { key: "constructionYear", label: "Year opened", description: "Construction year.", format: "integer", direction: "desc", group: "Physical", tier: "core", entityType: "stadium", populatedEntityCount: 3, eligibleEntityCount: 3, coverage: 1, distinctValueCount: 3, available: true, comparative: true },
  ],
  entities: [
    { id: "stadium:1", entityType: "stadium", name: "Alpha Field", imageUrl: "https://cdn.collegefootballdata.com/logos/1.png", color: "#17365d", attributes: { team: "Alpha State", city: "Athens", state: "GA", conference: "Atlantic", capacity: 92000, constructionYear: 1929, dome: false, grass: true } },
    { id: "stadium:2", entityType: "stadium", name: "Beta Stadium", color: "#772f40", attributes: { team: "Beta Tech", city: "Columbus", state: "OH", conference: "Central", capacity: 76000, constructionYear: 1954, dome: false, grass: false } },
    { id: "stadium:3", entityType: "stadium", name: "Gamma Dome", color: "#154734", attributes: { team: "Gamma University", city: "Atlanta", state: "GA", conference: "Central", capacity: 63000, constructionYear: 2017, dome: true, grass: false } },
  ],
} satisfies DatasetEnvelope;
