import { NextResponse } from "next/server";
import { createPublicSupabaseClient } from "@/lib/supabase/clients";
import { supabaseSetupState } from "@/lib/supabase/config";
import type { PlatformStatus } from "@/lib/domain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const setup = supabaseSetupState();
  const client = createPublicSupabaseClient();
  if (!client) {
    const status: PlatformStatus = {
      ...setup,
      schemaReady: false,
      tableCount: 0,
      entityTypeCount: 0,
      entityCount: 0,
      message: "Add the Supabase URL and publishable key to this runtime.",
    };
    return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
  }

  const [domains, entityTypes, entities, dataset] = await Promise.all([
    client.from("domains").select("id", { count: "exact", head: true }),
    client.from("entity_types").select("id", { count: "exact", head: true }),
    client.from("entities").select("id", { count: "exact", head: true }),
    client.from("datasets").select("active_version_id, dataset_versions!datasets_active_version_id_fkey(version_key)").eq("slug", "cfbd-season").maybeSingle(),
  ]);
  const schemaReady = !domains.error && !entityTypes.error && (domains.count ?? 0) > 0;
  const relation = dataset.data?.dataset_versions;
  const activeDatasetVersion = relation && !Array.isArray(relation) ? relation.version_key : undefined;
  const status: PlatformStatus = {
    ...setup,
    schemaReady,
    tableCount: schemaReady ? 29 : 0,
    entityTypeCount: entityTypes.count ?? 0,
    entityCount: entities.count ?? 0,
    activeDatasetVersion,
    message: !schemaReady
      ? "Supabase is reachable, but the Ranked migration has not been applied."
      : !setup.serverWriteConfigured
        ? "Schema is ready. Add the server secret so CFBD refreshes can persist data."
        : activeDatasetVersion
          ? "Relational database and saved dataset are connected."
          : "Schema is ready. Run the first CFBD refresh to populate canonical entities and metrics.",
  };
  return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
}
