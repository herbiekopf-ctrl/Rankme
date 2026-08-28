import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/clients";
import { loadUnlockedConsensusFilterCatalog } from "@/lib/supabase/consensusFilterCatalog";

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
}

export async function GET(request: Request) {
  const client = createAdminSupabaseClient();
  if (!client) return NextResponse.json({ categories: [] }, { status: 503 });
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ categories: [] });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user || data.user.is_anonymous) return NextResponse.json({ categories: [] });
  try {
    const categories = await loadUnlockedConsensusFilterCatalog(data.user.id, client);
    return NextResponse.json({ categories }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ categories: [] }, { status: 503 });
  }
}
