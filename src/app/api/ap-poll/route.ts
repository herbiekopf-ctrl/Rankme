import { NextResponse } from "next/server";
import { apGridPath, parseApPoll } from "@/lib/adapters/apPoll";
export const runtime = "nodejs";
async function page(url: string) {
  const response = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("AP source unavailable");
  return response.text();
}
export async function GET() {
  try {
    const list = await page("https://collegepolltracker.com/football/");
    const grid = await page(apGridPath(list)).catch(() => "");
    return NextResponse.json(parseApPoll(list, grid), { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ error: "The AP poll could not be loaded. Please try again." }, { status: 503 });
  }
}
