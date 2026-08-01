import { NextResponse } from "next/server";
import { getCollegeFootballDataset } from "@/lib/adapters/cfbd";
import { seedTeamDataset } from "@/lib/domain/seed";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const yearParam = new URL(request.url).searchParams.get("year");
  const year = Number(yearParam ?? 2026);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  if (!process.env.CFBD_API_KEY) {
    return NextResponse.json(seedTeamDataset(), {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
    });
  }

  try {
    const dataset = await getCollegeFootballDataset(year);
    return NextResponse.json(dataset, {
      headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" },
    });
  } catch {
    const fallback = seedTeamDataset();
    return NextResponse.json(
      { ...fallback, stale: true, sourceLabel: "Demo data · live source unavailable" },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  }
}
