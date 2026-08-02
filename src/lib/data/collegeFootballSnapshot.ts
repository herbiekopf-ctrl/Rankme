import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { pullCollegeFootballSnapshot, type CollegeFootballSnapshot } from "@/lib/adapters/cfbd";
import { persistCollegeFootballSnapshot } from "@/lib/data/supabaseSnapshot";

export type SnapshotResult = {
  snapshot: CollegeFootballSnapshot;
  stale: boolean;
  refreshMode: "saved-snapshot" | "framework-cache";
};

const inflight = new Map<number, Promise<SnapshotResult>>();
const memorySnapshots = new Map<number, CollegeFootballSnapshot>();

function refreshMilliseconds(): number {
  const seconds = Number(process.env.CFBD_REFRESH_SECONDS ?? 604_800);
  return (Number.isFinite(seconds) && seconds >= 3_600 ? seconds : 604_800) * 1_000;
}

function snapshotPath(year: number): string {
  const directory = process.env.CFBD_SNAPSHOT_DIR ?? path.join(process.cwd(), ".data");
  return path.join(directory, `college-football-${year}.json`);
}

function looksLikeSnapshot(value: unknown, year: number): value is CollegeFootballSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CollegeFootballSnapshot>;
  return candidate.year === year
    && typeof candidate.version === "string"
    && typeof candidate.refreshedAt === "string"
    && Array.isArray(candidate.teams)
    && Array.isArray(candidate.players)
    && Array.isArray(candidate.coaches)
    && Array.isArray(candidate.conferences)
    && Array.isArray(candidate.games)
    && Array.isArray(candidate.mascots)
    && Array.isArray(candidate.towns)
    && Array.isArray(candidate.stadiums)
    && Array.isArray(candidate.recruitingClasses)
    && Array.isArray(candidate.recruits)
    && Array.isArray(candidate.transfers)
    && Array.isArray(candidate.units)
    && Array.isArray(candidate.teamSeasons)
    && Array.isArray(candidate.draftPicks)
    && Boolean(candidate.metricsByEntityType);
}

async function readSavedSnapshot(year: number): Promise<CollegeFootballSnapshot | null> {
  const inMemory = memorySnapshots.get(year);
  if (inMemory) return inMemory;
  try {
    const parsed: unknown = JSON.parse(await readFile(snapshotPath(year), "utf8"));
    if (!looksLikeSnapshot(parsed, year)) return null;
    const snapshot = { ...parsed, warnings: parsed.warnings ?? [] };
    memorySnapshots.set(year, snapshot);
    return snapshot;
  } catch {
    return null;
  }
}

async function saveSnapshot(snapshot: CollegeFootballSnapshot): Promise<boolean> {
  memorySnapshots.set(snapshot.year, snapshot);
  const target = snapshotPath(snapshot.year);
  const temporary = `${target}.${process.pid}.tmp`;
  try {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(temporary, JSON.stringify(snapshot), "utf8");
    await rename(temporary, target);
    return true;
  } catch {
    return false;
  }
}

async function loadOrRefresh(year: number): Promise<SnapshotResult> {
  const saved = await readSavedSnapshot(year);
  if (saved && Date.now() - new Date(saved.refreshedAt).getTime() < refreshMilliseconds()) {
    return { snapshot: saved, stale: false, refreshMode: "saved-snapshot" };
  }

  try {
    let snapshot = await pullCollegeFootballSnapshot(year);
    try {
      await persistCollegeFootballSnapshot(snapshot);
    } catch {
      snapshot = { ...snapshot, warnings: [...snapshot.warnings, "The CFBD snapshot is usable, but its relational Supabase save failed. Check /api/platform/status and server logs."] };
    }
    const savedToDisk = await saveSnapshot(snapshot);
    return { snapshot, stale: false, refreshMode: savedToDisk ? "saved-snapshot" : "framework-cache" };
  } catch (error) {
    if (saved) return { snapshot: saved, stale: true, refreshMode: "saved-snapshot" };
    throw error;
  }
}

export function getCollegeFootballSnapshot(year: number): Promise<SnapshotResult> {
  const existing = inflight.get(year);
  if (existing) return existing;
  const promise = loadOrRefresh(year).finally(() => inflight.delete(year));
  inflight.set(year, promise);
  return promise;
}
