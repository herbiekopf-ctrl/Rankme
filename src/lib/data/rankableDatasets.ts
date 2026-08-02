import "server-only";

import { TEAM_METRICS, teamsDataset, type CollegeFootballSnapshot } from "@/lib/adapters/cfbd";
import { getCollegeFootballSnapshot } from "@/lib/data/collegeFootballSnapshot";
import { seedStadiumDataset, seedTeamDataset } from "@/lib/domain/seed";
import type { DatasetEnvelope, PollCatalog, RankingSubject } from "@/lib/domain/types";

function envelope(
  result: Awaited<ReturnType<typeof getCollegeFootballSnapshot>>,
  suffix: string,
  entities: DatasetEnvelope["entities"],
  metrics = false,
): DatasetEnvelope {
  return {
    id: `${result.snapshot.id}-${suffix}`,
    version: result.snapshot.version,
    source: "collegefootballdata",
    sourceLabel: result.snapshot.sourceLabel,
    refreshedAt: result.snapshot.refreshedAt,
    stale: result.stale,
    connected: true,
    credentialConfigured: true,
    refreshMode: result.refreshMode,
    upstreamRequests: result.snapshot.upstreamRequests,
    warnings: result.snapshot.warnings,
    metricDefinitions: metrics ? TEAM_METRICS : undefined,
    entities,
  };
}

export async function loadTeamDataset(year: number): Promise<DatasetEnvelope> {
  if (!process.env.CFBD_API_KEY) return { ...seedTeamDataset(), credentialConfigured: false };
  try {
    const result = await getCollegeFootballSnapshot(year);
    return { ...teamsDataset(result.snapshot), stale: result.stale, refreshMode: result.refreshMode };
  } catch {
    return {
      ...seedTeamDataset(),
      stale: true,
      credentialConfigured: true,
      sourceLabel: "Demo data · CFBD key found, but refresh failed",
      warnings: ["The server found CFBD_API_KEY, but CFBD did not return a valid team snapshot."],
    };
  }
}

function entitiesForSubject(
  snapshot: CollegeFootballSnapshot,
  subject: RankingSubject,
  conference?: string,
  position?: string,
) {
  switch (subject) {
    case "conference-teams":
      return snapshot.teams.filter((entity) => !conference || entity.attributes.conference === conference);
    case "mascots":
      return snapshot.mascots.filter((entity) => !conference || entity.attributes.conference === conference);
    case "towns":
      return snapshot.towns;
    case "stadiums":
      return snapshot.stadiums.filter((entity) => !conference || entity.attributes.conference === conference);
    case "players":
      return snapshot.players.filter((entity) =>
        (!conference || entity.attributes.conference === conference)
        && (!position || entity.attributes.position === position),
      );
    default:
      return snapshot.teams;
  }
}

export async function loadRankableDataset(
  year: number,
  subject: RankingSubject,
  conference?: string,
  position?: string,
): Promise<DatasetEnvelope> {
  if (subject === "manual") throw new Error("Manual polls do not use the CFBD dataset");
  if (!process.env.CFBD_API_KEY) {
    if (subject === "stadiums") return seedStadiumDataset();
    const fallback = seedTeamDataset();
    return subject === "teams" || subject === "conference-teams"
      ? { ...fallback, credentialConfigured: false, entities: fallback.entities.filter((entity) => !conference || entity.attributes.conference === conference) }
      : { ...fallback, credentialConfigured: false, id: `${fallback.id}-${subject}`, entities: [], sourceLabel: "Demo data · add CFBD_API_KEY for this list" };
  }
  const result = await getCollegeFootballSnapshot(year);
  const entities = entitiesForSubject(result.snapshot, subject, conference, position);
  return envelope(result, subject, entities, subject === "teams" || subject === "conference-teams");
}

export async function loadPollCatalog(year: number): Promise<PollCatalog> {
  if (!process.env.CFBD_API_KEY) {
    const teams = seedTeamDataset();
    const conferences = [...new Set(teams.entities.map((entity) => String(entity.attributes.conference)))].sort();
    return {
      year,
      connected: false,
      sourceLabel: teams.sourceLabel,
      refreshedAt: teams.refreshedAt,
      refreshMode: "fixture",
      upstreamRequests: 0,
      warnings: [],
      conferences,
      positions: ["QB", "RB", "WR", "TE"],
      subjects: [
        { id: "teams", label: "All FBS teams", description: "Every FBS school in the saved season dataset.", count: teams.entities.length, available: true },
        { id: "conference-teams", label: "Conference schools", description: "Pick the ACC, SEC, Big Ten, Big 12, or another league.", count: teams.entities.length, available: true },
        { id: "stadiums", label: "Stadiums", description: "Rank venues and game-day settings.", count: seedStadiumDataset().entities.length, available: true },
        { id: "manual", label: "My own options", description: "Paste any set of choices, one per line.", count: 0, available: true },
      ],
    };
  }

  const result = await getCollegeFootballSnapshot(year);
  const { snapshot } = result;
  const conferences = [...new Set(snapshot.teams.map((entity) => String(entity.attributes.conference)).filter(Boolean))].sort();
  const positions = [...new Set(snapshot.players.map((entity) => String(entity.attributes.position)).filter(Boolean))].sort();
  return {
    year,
    connected: true,
    sourceLabel: snapshot.sourceLabel,
    refreshedAt: snapshot.refreshedAt,
    refreshMode: result.refreshMode,
    upstreamRequests: snapshot.upstreamRequests,
    warnings: snapshot.warnings,
    conferences,
    positions,
    subjects: [
      { id: "teams", label: "All FBS teams", description: "Every FBS school in the saved season dataset.", count: snapshot.teams.length, available: snapshot.teams.length > 0 },
      { id: "conference-teams", label: "Conference schools", description: "Choose a league such as the ACC and rank only those schools.", count: snapshot.teams.length, available: snapshot.teams.length > 0 },
      { id: "mascots", label: "Mascots", description: "Every FBS team's mascot, with school context.", count: snapshot.mascots.length, available: snapshot.mascots.length > 0 },
      { id: "towns", label: "College towns", description: "Rank the cities and towns that host FBS football.", count: snapshot.towns.length, available: snapshot.towns.length > 0 },
      { id: "stadiums", label: "Stadiums", description: "Venues, capacities, schools, and locations from CFBD.", count: snapshot.stadiums.length, available: snapshot.stadiums.length > 0 },
      { id: "players", label: "Players by position", description: snapshot.players.length ? "Choose WR, QB, RB, or any roster position." : "Roster data was unavailable in the latest snapshot.", count: snapshot.players.length, available: snapshot.players.length > 0 },
      { id: "manual", label: "My own options", description: "Paste any set of choices, one per line.", count: 0, available: true },
    ],
  };
}
