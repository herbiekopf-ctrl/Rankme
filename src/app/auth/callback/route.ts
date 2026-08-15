import type { NextRequest } from "next/server";
import { completeRankedOAuthSignIn } from "@/lib/supabase/authCallback";

export async function GET(request: NextRequest) {
  return completeRankedOAuthSignIn(request);
}
