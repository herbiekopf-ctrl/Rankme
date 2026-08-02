import type { DatasetEnvelope, RankableEntity } from "./types";

const TEAM_SEEDS = [
  ["ohio-state", "Ohio State", "OSU", "Buckeyes", "Big Ten", "#ba0c2f"],
  ["texas", "Texas", "TEX", "Longhorns", "SEC", "#bf5700"],
  ["georgia", "Georgia", "UGA", "Bulldogs", "SEC", "#ba0c2f"],
  ["penn-state", "Penn State", "PSU", "Nittany Lions", "Big Ten", "#041e42"],
  ["oregon", "Oregon", "ORE", "Ducks", "Big Ten", "#154733"],
  ["notre-dame", "Notre Dame", "ND", "Fighting Irish", "Independent", "#0c2340"],
  ["clemson", "Clemson", "CLEM", "Tigers", "ACC", "#f56600"],
  ["alabama", "Alabama", "ALA", "Crimson Tide", "SEC", "#9e1b32"],
  ["lsu", "LSU", "LSU", "Tigers", "SEC", "#461d7c"],
  ["miami", "Miami", "MIA", "Hurricanes", "ACC", "#f47321"],
  ["arizona-state", "Arizona State", "ASU", "Sun Devils", "Big 12", "#8c1d40"],
  ["boise-state", "Boise State", "BSU", "Broncos", "Mountain West", "#0033a0"],
  ["tennessee", "Tennessee", "TENN", "Volunteers", "SEC", "#ff8200"],
  ["michigan", "Michigan", "MICH", "Wolverines", "Big Ten", "#00274c"],
  ["ole-miss", "Ole Miss", "MISS", "Rebels", "SEC", "#ce1126"],
  ["south-carolina", "South Carolina", "SC", "Gamecocks", "SEC", "#73000a"],
  ["illinois", "Illinois", "ILL", "Fighting Illini", "Big Ten", "#13294b"],
  ["byu", "BYU", "BYU", "Cougars", "Big 12", "#002e5d"],
  ["kansas-state", "Kansas State", "KSU", "Wildcats", "Big 12", "#512888"],
  ["indiana", "Indiana", "IU", "Hoosiers", "Big Ten", "#990000"],
  ["iowa-state", "Iowa State", "ISU", "Cyclones", "Big 12", "#c8102e"],
  ["florida", "Florida", "FLA", "Gators", "SEC", "#0021a5"],
  ["texas-am", "Texas A&M", "TAMU", "Aggies", "SEC", "#500000"],
  ["utah", "Utah", "UTAH", "Utes", "Big 12", "#cc0000"],
  ["auburn", "Auburn", "AUB", "Tigers", "SEC", "#0c2340"],
  ["louisville", "Louisville", "LOU", "Cardinals", "ACC", "#ad0000"],
  ["nebraska", "Nebraska", "NEB", "Cornhuskers", "Big Ten", "#e41c38"],
  ["oklahoma", "Oklahoma", "OU", "Sooners", "SEC", "#841617"],
  ["usc", "USC", "USC", "Trojans", "Big Ten", "#990000"],
  ["washington", "Washington", "WASH", "Huskies", "Big Ten", "#4b2e83"],
  ["tcu", "TCU", "TCU", "Horned Frogs", "Big 12", "#4d1979"],
  ["missouri", "Missouri", "MIZ", "Tigers", "SEC", "#f1b82d"],
] as const;

export const seedTeams: RankableEntity[] = TEAM_SEEDS.map(
  ([id, name, shortName, mascot, conference, color], index) => ({
    id: `team:${id}`,
    entityType: "team",
    name,
    shortName,
    aliases: [shortName, mascot],
    color,
    attributes: {
      mascot,
      conference,
      record: "0-0",
      lastResult: "Preseason",
      nextOpponent: "Schedule pending",
      suggestion: index < 12 ? "National contender" : index < 25 ? "Top 25 candidate" : "On the radar",
    },
  }),
);

export const seedStadiums: RankableEntity[] = [
  ["death-valley-clemson", "Memorial Stadium", "Clemson", "Clemson, SC", 81500, "#f56600"],
  ["tiger-stadium", "Tiger Stadium", "LSU", "Baton Rouge, LA", 102321, "#461d7c"],
  ["beaver-stadium", "Beaver Stadium", "Penn State", "University Park, PA", 106572, "#041e42"],
  ["the-shoe", "Ohio Stadium", "Ohio State", "Columbus, OH", 102780, "#ba0c2f"],
  ["kyle-field", "Kyle Field", "Texas A&M", "College Station, TX", 102733, "#500000"],
  ["sanford-stadium", "Sanford Stadium", "Georgia", "Athens, GA", 92746, "#ba0c2f"],
  ["camp-randall", "Camp Randall Stadium", "Wisconsin", "Madison, WI", 76057, "#c5050c"],
  ["autzen", "Autzen Stadium", "Oregon", "Eugene, OR", 54000, "#154733"],
  ["neyland", "Neyland Stadium", "Tennessee", "Knoxville, TN", 101915, "#ff8200"],
  ["michigan-stadium", "Michigan Stadium", "Michigan", "Ann Arbor, MI", 107601, "#00274c"],
  ["doak", "Doak Campbell Stadium", "Florida State", "Tallahassee, FL", 79560, "#782f40"],
  ["lane", "Lane Stadium", "Virginia Tech", "Blacksburg, VA", 66233, "#861f41"],
  ["rose-bowl", "Rose Bowl", "UCLA", "Pasadena, CA", 88565, "#2774ae"],
  ["darrell-k-royal", "Darrell K Royal–Texas Memorial Stadium", "Texas", "Austin, TX", 100119, "#bf5700"],
].map(([id, name, team, city, capacity, color]) => ({
  id: `stadium:${id}`,
  entityType: "stadium",
  name: String(name),
  aliases: [String(team), String(city)],
  color: String(color),
  attributes: { team: String(team), city: String(city), capacity: Number(capacity) },
}));

export function seedTeamDataset(): DatasetEnvelope {
  return {
    id: "college-football-teams-2026",
    version: "seed-2026-preseason-v1",
    source: "seed",
    sourceLabel: "Ranked preseason demo data",
    refreshedAt: "2026-08-01T12:00:00.000Z",
    stale: false,
    connected: false,
    credentialConfigured: false,
    refreshMode: "fixture",
    upstreamRequests: 0,
    entities: seedTeams,
  };
}

export function seedStadiumDataset(): DatasetEnvelope {
  return {
    id: "college-football-stadiums",
    version: "curated-stadiums-v1",
    source: "curated",
    sourceLabel: "Ranked curated stadium data",
    refreshedAt: "2026-07-30T12:00:00.000Z",
    stale: false,
    connected: true,
    credentialConfigured: false,
    refreshMode: "fixture",
    upstreamRequests: 0,
    entities: seedStadiums,
  };
}
