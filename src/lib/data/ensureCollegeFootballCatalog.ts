import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/clients";

const ENTITY_TYPES = [
  ["team", "Team", "Teams", "College football teams and programs"],
  ["player", "Player", "Players", "Rostered and historical players"],
  ["coach", "Coach", "Coaches", "Head coaches, coordinators, and staff"],
  ["conference", "Conference", "Conferences", "Current and historical conferences"],
  ["town", "Town", "Towns", "College towns and host cities"],
  ["stadium", "Stadium", "Stadiums", "Venues and game-day settings"],
  ["mascot", "Mascot", "Mascots", "Official team mascots"],
  ["game", "Game", "Games", "Scheduled and completed games"],
  ["unit", "Unit", "Units", "Offenses, defenses, and position groups"],
  ["recruiting-class", "Recruiting class", "Recruiting classes", "Team and position recruiting classes"],
  ["recruit", "Recruit", "Recruits", "High-school and junior-college recruits"],
  ["transfer", "Transfer", "Transfers", "Transfer portal entries and destinations"],
  ["team-season", "Team season", "Team seasons", "A program in one specific season"],
  ["draft-pick", "NFL draft pick", "NFL draft picks", "College players selected in the NFL Draft"],
] as const;

export async function ensureCollegeFootballCatalog(): Promise<void> {
  const client = createAdminSupabaseClient();
  if (!client) throw new Error("Missing Supabase server secret");

  const { data: domain, error: domainError } = await client.from("domains").upsert({
    slug: "college-football",
    name: "College Football",
    description: "Teams, people, places, games, culture, and every rankable college-football concept.",
    status: "active",
  }, { onConflict: "slug" }).select("id").single();
  if (domainError || !domain) throw domainError ?? new Error("Could not create the college-football domain");

  const { data: source, error: sourceError } = await client.from("data_sources").upsert({
    slug: "cfbd",
    name: "CollegeFootballData",
    homepage_url: "https://collegefootballdata.com",
    rights_metadata: { adapter: "replaceable", redistribution: "subject-to-provider-terms" },
  }, { onConflict: "slug" }).select("id").single();
  if (sourceError || !source) throw sourceError ?? new Error("Could not create the CFBD data source");

  const { error: entityTypesError } = await client.from("entity_types").upsert(
    ENTITY_TYPES.map(([slug, singularName, pluralName, description]) => ({
      domain_id: domain.id,
      slug,
      singular_name: singularName,
      plural_name: pluralName,
      description,
      presentation_schema: { rankable: true, source: "cfbd" },
    })),
    { onConflict: "domain_id,slug" },
  );
  if (entityTypesError) throw entityTypesError;

  const { error: datasetError } = await client.from("datasets").upsert({
    domain_id: domain.id,
    source_id: source.id,
    slug: "cfbd-season",
    name: "College football season data",
    description: "Canonical saved season snapshots used by comparisons and ranking option pools.",
    refresh_cadence: "weekly",
  }, { onConflict: "domain_id,slug" });
  if (datasetError) throw datasetError;
}
