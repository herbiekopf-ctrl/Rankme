import { NextResponse } from "next/server";
import { loadRankableDataset } from "@/lib/data/rankableDatasets";
import { isRankingSubject, rankableCategory } from "@/lib/domain/rankableCatalog";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const year = Number(params.get("year") ?? 2026);
  const subject = params.get("subject") ?? "teams";
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  if (!isRankingSubject(subject)) {
    return NextResponse.json({ error: "Invalid ranking subject" }, { status: 400 });
  }
  try {
    const allowedFilters = new Set(rankableCategory(subject).filterKeys);
    const filters = Object.fromEntries([...params.entries()].filter(([key, value]) => allowedFilters.has(key) && value && value !== "All"));
    const dataset = await loadRankableDataset(year, subject, filters);
    return NextResponse.json(dataset, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch {
    return NextResponse.json({ error: "The saved college football dataset is unavailable." }, { status: 503 });
  }
}
