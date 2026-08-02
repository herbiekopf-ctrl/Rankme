import { NextResponse } from "next/server";
import { loadRankableDataset } from "@/lib/data/rankableDatasets";
import type { RankingSubject } from "@/lib/domain/types";

export const runtime = "nodejs";

const subjects = new Set<RankingSubject>(["teams", "conference-teams", "mascots", "towns", "stadiums", "players"]);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const year = Number(params.get("year") ?? 2026);
  const subject = (params.get("subject") ?? "teams") as RankingSubject;
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  if (!subjects.has(subject)) {
    return NextResponse.json({ error: "Invalid ranking subject" }, { status: 400 });
  }
  try {
    const dataset = await loadRankableDataset(
      year,
      subject,
      params.get("conference") ?? undefined,
      params.get("position") ?? undefined,
    );
    return NextResponse.json(dataset, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch {
    return NextResponse.json({ error: "The saved college football dataset is unavailable." }, { status: 503 });
  }
}
