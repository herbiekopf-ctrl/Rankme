import { pullCollegeFootballSnapshot } from "../src/lib/adapters/cfbd";
import { ensureCollegeFootballCatalog } from "../src/lib/data/ensureCollegeFootballCatalog";
import { persistCollegeFootballSnapshot } from "../src/lib/data/supabaseSnapshot";

function requestedYears(): number[] {
  const raw = process.argv[2] ?? "[2026]";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Years must be a JSON array, for example [2025] or [2025,2026].");
  }
  if (!Array.isArray(parsed)) throw new Error("Years must be a JSON array.");
  const years = [...new Set(parsed.map(Number))].sort((left, right) => left - right);
  if (!years.length || years.length > 10 || years.some((year) => !Number.isInteger(year) || year < 2000 || year > 2100)) {
    throw new Error("Provide between one and ten valid seasons.");
  }
  return years;
}

function verifyEnvironment(): void {
  const required = [
    "CFBD_API_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
  ];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length) throw new Error(`Missing required secrets: ${missing.join(", ")}`);
}

async function main(): Promise<void> {
  verifyEnvironment();
  const years = requestedYears();
  console.log(`Starting direct CFBD → Supabase import for ${years.join(", ")}.`);

  console.log("Checking Supabase catalog before contacting CFBD...");
  await ensureCollegeFootballCatalog();
  console.log("Supabase catalog is ready.");

  for (const year of years) {
    const started = Date.now();
    console.log(`[${year}] Fetching 26 CFBD feeds...`);
    const snapshot = await pullCollegeFootballSnapshot(year);
    const entityCount = Object.values(snapshot)
      .filter(Array.isArray)
      .reduce((total, rows) => total + rows.length, 0);
    console.log(`[${year}] Fetched ${entityCount.toLocaleString()} entities; writing duplicate-safe batches to Supabase...`);

    const result = await persistCollegeFootballSnapshot(snapshot);
    if (!result.persisted && result.reason !== "already-published") {
      throw new Error(`[${year}] Supabase did not publish the season (${result.reason ?? "unknown reason"}).`);
    }
    console.log(JSON.stringify({
      year,
      ok: true,
      versionId: result.versionId,
      entityCount: result.entityCount ?? entityCount,
      attributeValueCount: result.attributeValueCount,
      warnings: snapshot.warnings,
      elapsedSeconds: Math.round((Date.now() - started) / 1000),
    }));
  }

  console.log("Direct import completed. Every requested season was published successfully.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
