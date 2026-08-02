import { NextResponse } from "next/server";
import { loadTeamDataset } from "@/lib/data/rankableDatasets";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const yearParam = new URL(request.url).searchParams.get("year");
  const year = Number(yearParam ?? 2026);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  const dataset = await loadTeamDataset(year);
  return NextResponse.json(dataset, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
