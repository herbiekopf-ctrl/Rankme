import type { RankingSubject } from "./types";

export type RankableCategoryDefinition = {
  id: RankingSubject;
  entityType: string;
  label: string;
  singularLabel: string;
  description: string;
  group: "People" | "Programs" | "Places" | "Competition" | "History" | "Culture";
  icon: string;
  defaultLength: number;
  defaultTitle: string;
  visibleAttributes: string[];
  filterKeys: string[];
  exampleQuestions: string[];
};

export const RANKABLE_CATEGORIES: readonly RankableCategoryDefinition[] = [
  {
    id: "teams",
    entityType: "team",
    label: "Teams",
    singularLabel: "team",
    description: "Every FBS program, filterable by conference and season.",
    group: "Programs",
    icon: "T",
    defaultLength: 25,
    defaultTitle: "My College Football Top 25",
    visibleAttributes: ["record", "conference", "lastResult", "nextOpponent"],
    filterKeys: ["conference"],
    exampleQuestions: ["Best teams right now", "Most likely team to win the title", "Programs built to last"],
  },
  {
    id: "players",
    entityType: "player",
    label: "Players",
    singularLabel: "player",
    description: "Rostered players with production, usage, efficiency, and team context.",
    group: "People",
    icon: "P",
    defaultLength: 10,
    defaultTitle: "Best Players in College Football",
    visibleAttributes: ["team", "position", "conference", "classYear"],
    filterKeys: ["conference", "team", "position", "classYear"],
    exampleQuestions: ["Best quarterbacks", "Most valuable players", "Breakout candidates"],
  },
  {
    id: "coaches",
    entityType: "coach",
    label: "Coaches",
    singularLabel: "coach",
    description: "Head coaches with current-season, career, and team performance context.",
    group: "People",
    icon: "C",
    defaultLength: 10,
    defaultTitle: "Best Coaches in College Football",
    visibleAttributes: ["team", "conference", "record", "careerWinPct"],
    filterKeys: ["conference", "team"],
    exampleQuestions: ["Best coaches right now", "Next coach to win a title", "Coaches you would hire"],
  },
  {
    id: "conferences",
    entityType: "conference",
    label: "Conferences",
    singularLabel: "conference",
    description: "Conferences connected to every member team and league-wide metric.",
    group: "Programs",
    icon: "L",
    defaultLength: 10,
    defaultTitle: "Best Conferences in College Football",
    visibleAttributes: ["teamCount", "totalWins", "averageElo"],
    filterKeys: [],
    exampleQuestions: ["Strongest conferences", "Most entertaining leagues", "Best long-term position"],
  },
  {
    id: "games",
    entityType: "game",
    label: "Games",
    singularLabel: "game",
    description: "Completed and scheduled matchups with score, venue, and excitement context.",
    group: "Competition",
    icon: "G",
    defaultLength: 10,
    defaultTitle: "Best Games of the Season",
    visibleAttributes: ["week", "matchup", "score", "date"],
    filterKeys: ["week", "completed", "conferenceGame"],
    exampleQuestions: ["Best games this season", "Most important remaining games", "Wildest finishes"],
  },
  {
    id: "stadiums",
    entityType: "stadium",
    label: "Stadiums",
    singularLabel: "stadium",
    description: "CFBD venues with location, capacity, surface, construction, and setting data.",
    group: "Places",
    icon: "S",
    defaultLength: 10,
    defaultTitle: "Best College Football Stadiums",
    visibleAttributes: ["team", "city", "state", "capacity", "constructionYear", "grass", "dome"],
    filterKeys: ["state", "conference", "dome", "grass"],
    exampleQuestions: ["Best stadium atmospheres", "Toughest places to play", "Best stadium road trips"],
  },
  {
    id: "towns",
    entityType: "town",
    label: "College towns",
    singularLabel: "college town",
    description: "Host cities connected to their programs and venues.",
    group: "Places",
    icon: "O",
    defaultLength: 10,
    defaultTitle: "Best College Football Towns",
    visibleAttributes: ["state", "schools", "teamCount"],
    filterKeys: ["state"],
    exampleQuestions: ["Best college towns", "Best road-trip weekends", "Most underrated CFB towns"],
  },
  {
    id: "mascots",
    entityType: "mascot",
    label: "Mascots",
    singularLabel: "mascot",
    description: "Official team mascots tied to their program and conference.",
    group: "Culture",
    icon: "M",
    defaultLength: 10,
    defaultTitle: "Best Mascots in College Football",
    visibleAttributes: ["school", "conference"],
    filterKeys: ["conference"],
    exampleQuestions: ["Best mascots", "Most intimidating mascots", "Mascots built for chaos"],
  },
  {
    id: "recruiting-classes",
    entityType: "recruiting-class",
    label: "Recruiting classes",
    singularLabel: "recruiting class",
    description: "Team recruiting classes with national rank and composite points.",
    group: "Programs",
    icon: "R",
    defaultLength: 10,
    defaultTitle: "Best Recruiting Classes",
    visibleAttributes: ["team", "year", "nationalRank", "points"],
    filterKeys: ["conference"],
    exampleQuestions: ["Best recruiting classes", "Classes most likely to outperform", "Best future rosters"],
  },
  {
    id: "recruits",
    entityType: "recruit",
    label: "Recruits",
    singularLabel: "recruit",
    description: "High-school and junior-college recruits with ranking, rating, stars, and commitment.",
    group: "People",
    icon: "5",
    defaultLength: 10,
    defaultTitle: "Best Recruits in the Class",
    visibleAttributes: ["committedTo", "position", "stars", "nationalRank"],
    filterKeys: ["committedTo", "position", "stars", "state"],
    exampleQuestions: ["Best recruits", "Most college-ready prospects", "Biggest recruiting wins"],
  },
  {
    id: "transfers",
    entityType: "transfer",
    label: "Transfers",
    singularLabel: "transfer",
    description: "Portal entries with origin, destination, position, rating, and eligibility.",
    group: "People",
    icon: "↗",
    defaultLength: 10,
    defaultTitle: "Best Transfers in College Football",
    visibleAttributes: ["origin", "destination", "position", "stars"],
    filterKeys: ["origin", "destination", "position", "stars"],
    exampleQuestions: ["Best portal additions", "Transfers with the biggest impact", "Best value pickups"],
  },
  {
    id: "units",
    entityType: "unit",
    label: "Offenses & defenses",
    singularLabel: "unit",
    description: "Team offense and defense units built from the full advanced-stat catalog.",
    group: "Programs",
    icon: "U",
    defaultLength: 10,
    defaultTitle: "Best Units in College Football",
    visibleAttributes: ["team", "side", "conference"],
    filterKeys: ["side", "conference"],
    exampleQuestions: ["Best offenses", "Best defenses", "Units nobody wants to face"],
  },
  {
    id: "team-seasons",
    entityType: "team-season",
    label: "Team seasons",
    singularLabel: "team season",
    description: "Season-specific program records kept separate for historical rankings.",
    group: "History",
    icon: "Y",
    defaultLength: 10,
    defaultTitle: "Best Team Seasons",
    visibleAttributes: ["team", "year", "record", "conference"],
    filterKeys: ["conference"],
    exampleQuestions: ["Best teams of the last two seasons", "Best one-loss teams", "Most dominant seasons"],
  },
  {
    id: "draft-picks",
    entityType: "draft-pick",
    label: "NFL draft picks",
    singularLabel: "draft pick",
    description: "College players selected in the NFL Draft with round, pick, team, and pre-draft grade.",
    group: "History",
    icon: "D",
    defaultLength: 10,
    defaultTitle: "Best NFL Draft Picks from College Football",
    visibleAttributes: ["collegeTeam", "nflTeam", "round", "overall"],
    filterKeys: ["collegeConference", "collegeTeam", "position", "round"],
    exampleQuestions: ["Best draft picks", "Biggest draft steals", "Best pro prospects"],
  },
] as const;

export const RANKABLE_CATEGORY_BY_ID = new Map<RankingSubject, RankableCategoryDefinition>(
  RANKABLE_CATEGORIES.map((category) => [category.id, category]),
);

export function rankableCategory(subject: RankingSubject): RankableCategoryDefinition {
  const category = RANKABLE_CATEGORY_BY_ID.get(subject);
  if (!category) throw new Error(`Unknown ranking subject: ${subject}`);
  return category;
}

export function isRankingSubject(value: string): value is RankingSubject {
  return RANKABLE_CATEGORY_BY_ID.has(value as RankingSubject);
}
