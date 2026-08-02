import { NextResponse } from "next/server";
import { loadTeamDataset } from "@/lib/data/rankableDatasets";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const year = Number(new URL(request.url).searchParams.get("year") ?? 2026);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  const credentialConfigured = Boolean(process.env.CFBD_API_KEY);
  const dataset = await loadTeamDataset(year);
  const usingCfbdSnapshot = dataset.connected && dataset.source === "collegefootballdata";

  return NextResponse.json({
    credentialConfigured,
    usingCfbdSnapshot,
    status: usingCfbdSnapshot ? "connected" : credentialConfigured ? "refresh-failed" : "missing-key",
    year,
    entityCount: dataset.entities.length,
    snapshotVersion: dataset.version,
    refreshedAt: dataset.refreshedAt,
    refreshMode: dataset.refreshMode ?? "fixture",
    upstreamRequestsPerRefresh: dataset.upstreamRequests ?? 0,
    stale: dataset.stale,
    warnings: dataset.warnings ?? [],
  }, {
    headers: { "Cache-Control": "no-store" },
    status: usingCfbdSnapshot || !credentialConfigured ? 200 : 503,
  });
}
