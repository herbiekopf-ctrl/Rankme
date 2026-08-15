import { NextResponse } from "next/server";
import { loadPollCatalog } from "@/lib/data/rankableDatasets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const year = Number(new URL(request.url).searchParams.get("year") ?? 2026);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }
  try {
    return NextResponse.json(await loadPollCatalog(year), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json({ error: "The saved college football dataset is unavailable." }, { status: 503 });
  }
}
