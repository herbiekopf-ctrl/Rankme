/** Public AP ballot facts supplied by College Poll Tracker; never inferred from totals. */
export type ApTeam = { id: string; name: string; imageUrl: string; rank: number; points: number; firstPlaceVotes: number };
export type ApBallot = { id: string; name: string; affiliation: string; teamIds: string[] };
export type ApPoll = { season: number; week: string; releasedAt: string; sourceUrl: string; fetchedAt: string; teams: ApTeam[]; ballots: ApBallot[]; ballotsVerified: boolean };
const origin = "https://collegepolltracker.com";
function text(value: string) {
  return value.replace(/<[^>]*>/g, "").replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code))).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").trim();
}
function clean(html: string) { return html.replace(/<!--[\s\S]*?-->/g, ""); }
function metadata(html: string) {
  const match = clean(html).match(/(Week \d+|Preseason|Final) AP Poll \(([^)]+)\)/i);
  if (!match || !Number.isFinite(Date.parse(`${match[2]} 12:00:00 GMT`))) throw new Error("AP release date unavailable");
  return { week: match[1], releasedAt: new Date(`${match[2]} 12:00:00 GMT`).toISOString() };
}
export function parseApPoll(listHtml: string, gridHtml: string, fetchedAt = new Date().toISOString()): ApPoll {
  const list = clean(listHtml);
  const meta = metadata(list);
  const sourcePath = list.match(/href="(\/football\/grid\/(\d{4})\/(?:week-\d+|preseason|final))"/);
  if (!sourcePath) throw new Error("AP poll identity unavailable");
  const teams: ApTeam[] = [];
  for (const block of list.split('<div class="teamBar"').slice(1)) {
    const name = block.match(/class="teamName"><a href="\/football\/team\/([^/]+)\/\d{4}"[^>]*>([^<]+)<\/a>/);
    const rank = block.match(/class="teamRank">(\d+)</);
    const points = block.match(/class="teamPoints"><b>(\d+)<\/b>/);
    const logo = block.match(/class="teamLogo" src="(\/\/images\.collegepolltracker\.com\/logos\/[^"\s]+)"/);
    if (!name || !points || !logo) throw new Error("AP team data incomplete");
    const first = block.match(/class="teamFirst"><b>\((\d+)\)<\/b>/);
    teams.push({ id: name[1], name: text(name[2]), rank: rank ? Number(rank[1]) : teams.at(-1)?.rank ?? 0, points: Number(points[1]), firstPlaceVotes: Number(first?.[1] ?? 0), imageUrl: `https:${logo[1]}` });
  }
  if (teams.length < 25 || new Set(teams.map(t => t.id)).size !== teams.length || teams[0].rank !== 1) throw new Error("AP ranking incomplete");
  const ballots: ApBallot[] = [];
  let verified = false;
  try {
    const gridMeta = metadata(gridHtml);
    if (gridMeta.week !== meta.week || gridMeta.releasedAt !== meta.releasedAt) throw new Error("AP ballot release mismatch");
    for (const block of clean(gridHtml).split('<div class="gridRow">').slice(1)) {
      const voter = block.match(/class="gridPollster"><a href="\/football\/pollster\/([^/]+)\/[^" ]+">([^<]+)<\/a>/);
      const affiliation = block.match(/class="gridPollsterAffiliation">([\s\S]*?)<\/span>/);
      const teamIds = [...block.matchAll(/class="gridTeam gi_([^" ]+)"/g)].map(m => m[1]);
      if (teamIds.length === 25 && teamIds.every(id => id === "blank")) continue;
      if (!voter || teamIds.length !== 25 || new Set(teamIds).size !== 25) throw new Error("AP ballot incomplete");
      ballots.push({ id: voter[1], name: text(voter[2]), affiliation: text(affiliation?.[1] ?? ""), teamIds });
    }
    const totals = new Map<string, number>();
    const firsts = new Map<string, number>();
    for (const ballot of ballots) ballot.teamIds.forEach((id, i) => { totals.set(id, (totals.get(id) ?? 0) + 25 - i); if (!i) firsts.set(id, (firsts.get(id) ?? 0) + 1); });
    verified = ballots.length > 0 && new Set(ballots.map(b => b.id)).size === ballots.length
      && totals.size === teams.length && teams.every(t => totals.get(t.id) === t.points && (firsts.get(t.id) ?? 0) === t.firstPlaceVotes);
  } catch { verified = false; }
  return { ...meta, season: Number(sourcePath[2]), sourceUrl: `${origin}${sourcePath[1].replace('/grid/', '/')}`, fetchedAt, teams, ballots: verified ? ballots : [], ballotsVerified: verified };
}
export function apGridPath(html: string): string {
  const path = clean(html).match(/href="(\/football\/grid\/\d{4}\/(?:week-\d+|preseason|final))"/)?.[1];
  if (!path) throw new Error("AP source unavailable");
  return `${origin}${path}`;
}
