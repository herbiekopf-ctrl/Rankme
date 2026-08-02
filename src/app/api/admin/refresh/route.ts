import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getCollegeFootballSnapshot } from "@/lib/data/collegeFootballSnapshot";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const expected = process.env.RANKED_INGEST_TOKEN?.trim();
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!expected || !provided || expected.length !== provided.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { years?: unknown } = {};
  try {
    body = await request.json() as { years?: unknown };
  } catch {
    body = {};
  }
  const requested = Array.isArray(body.years) ? body.years : [new Date().getUTCFullYear()];
  const years = [...new Set(requested.map(Number))].sort((left, right) => left - right);
  if (!years.length || years.length > 10 || years.some((year) => !Number.isInteger(year) || year < 2000 || year > 2100)) {
    return NextResponse.json({ error: "Provide between one and ten valid seasons." }, { status: 400 });
  }
  const startedAt = new Date().toISOString();
  const receipts: Array<Record<string, unknown>> = [];
  for (const year of years) {
    try {
      const result = await getCollegeFootballSnapshot(year);
      receipts.push({
        year,
        ok: true,
        version: result.snapshot.version,
        refreshedAt: result.snapshot.refreshedAt,
        entityCount: Object.values(result.snapshot).filter(Array.isArray).reduce((total, rows) => total + rows.length, 0),
        upstreamRequests: result.snapshot.upstreamRequests,
        refreshMode: result.refreshMode,
        stale: result.stale,
        warnings: result.snapshot.warnings,
      });
    } catch (reason) {
      receipts.push({ year, ok: false, error: reason instanceof Error ? reason.message : "Unknown refresh failure" });
    }
  }
  const ok = receipts.every((receipt) => receipt.ok);
  return NextResponse.json({ ok, startedAt, completedAt: new Date().toISOString(), receipts }, { status: ok ? 200 : 503 });
}
