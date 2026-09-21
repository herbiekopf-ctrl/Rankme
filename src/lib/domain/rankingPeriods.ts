export type ResponseCadence = "once" | "weekly" | "seasonal";
export type RankingResponseStatus = "draft" | "published" | null;

export type RankingPeriodContext = {
  responseCadence: ResponseCadence;
  periodSlug: string;
  periodTitle: string;
  season: number;
  week: number | null;
  opensAt: string | null;
  closesAt: string | null;
  cycleId: string | null;
  rankingId: string | null;
  status: RankingResponseStatus;
  editable: boolean;
  entityIds: string[];
  createdAt: string | null;
  updatedAt: string | null;
  publishedAt: string | null;
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function easternCalendarDate(at: Date): { year: number; month: number; day: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(at);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    weekday: WEEKDAY_INDEX[value("weekday")] ?? 0,
  };
}

function calendarStamp(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function compactDate(date: Date, includeMonth = true): string {
  return new Intl.DateTimeFormat("en-US", includeMonth
    ? { month: "short", day: "numeric", timeZone: "UTC" }
    : { day: "numeric", timeZone: "UTC" }).format(date);
}

export function defaultResponseCadence(templateId: string, configured?: ResponseCadence): ResponseCadence {
  if (configured) return configured;
  return templateId === "top-25" ? "weekly" : "once";
}

export function localRankingPeriod(
  responseCadence: ResponseCadence,
  season: number,
  at = new Date(),
): RankingPeriodContext {
  if (responseCadence === "weekly") {
    const local = easternCalendarDate(at);
    const current = new Date(Date.UTC(local.year, local.month - 1, local.day));
    const mondayOffset = (local.weekday + 6) % 7;
    const start = new Date(current);
    start.setUTCDate(start.getUTCDate() - mondayOffset);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    const close = new Date(start);
    close.setUTCDate(close.getUTCDate() + 7);
    const sameMonth = start.getUTCMonth() === end.getUTCMonth();
    return {
      responseCadence,
      periodSlug: `${season}-response-week-${calendarStamp(start)}`,
      periodTitle: `Week of ${compactDate(start)}–${compactDate(end, !sameMonth)}`,
      season,
      week: null,
      opensAt: easternMidnight(start),
      closesAt: easternMidnight(close),
      cycleId: null,
      rankingId: null,
      status: null,
      editable: true,
      entityIds: [],
      createdAt: null,
      updatedAt: null,
      publishedAt: null,
    };
  }

  return {
    responseCadence,
    periodSlug: responseCadence === "seasonal" ? `${season}-season` : "single-response",
    periodTitle: responseCadence === "seasonal" ? `${season} season` : "One-time poll",
    season,
    week: null,
    opensAt: null,
    closesAt: null,
    cycleId: null,
    rankingId: null,
    status: null,
    editable: true,
    entityIds: [],
    createdAt: null,
    updatedAt: null,
    publishedAt: null,
  };
}

export function responseStateLabel(context: RankingPeriodContext): string {
  if (context.status === "published") return "Submitted";
  if (context.status === "draft") return "Draft in progress";
  return "Not started";
}

/** College football's season continues through the following spring. */
export function collegeFootballSeason(at = new Date()): number {
  const date = easternCalendarDate(at);
  return date.month < 7 ? date.year - 1 : date.year;
}

function easternMidnight(day: Date): string {
  const target = day.getTime();
  let instant = target + 5 * 3_600_000;
  for (let i = 0; i < 2; i++) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date(instant));
    const n = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(p => p.type === type)?.value);
    instant += target - Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"));
  }
  return new Date(instant).toISOString();
}

export function periodIsOpen(period: Pick<RankingPeriodContext, "opensAt" | "closesAt" | "editable">, at = Date.now()): boolean {
  return period.editable && (!period.opensAt || Date.parse(period.opensAt) <= at) && (!period.closesAt || at < Date.parse(period.closesAt));
}

export function votingDeadline(period: Pick<RankingPeriodContext, "closesAt">): string {
  if (!period.closesAt) return "";
  return `Closes ${new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" }).format(new Date(period.closesAt))}`;
}

export function recentWeeklyPeriods(season: number, at = new Date()): RankingPeriodContext[] {
  const current = localRankingPeriod("weekly", season, at);
  const monday = new Date(`${current.periodSlug.slice(-10)}T12:00:00Z`);
  return [2, 1, 0].map(weeksAgo => {
    const reference = new Date(monday);
    reference.setUTCDate(reference.getUTCDate() - 7 * weeksAgo);
    return localRankingPeriod("weekly", season, reference);
  });
}
