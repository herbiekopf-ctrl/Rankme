import "server-only";

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";

export async function completeRankedOAuthSignIn(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const destination = new URL("/auth/complete", url.origin);
  const code = url.searchParams.get("code");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!code || !supabaseUrl || !publishableKey) {
    destination.searchParams.set("error", "Sign-in could not be completed. Please try again.");
    const errorResponse = NextResponse.redirect(destination);
    errorResponse.headers.set("Cache-Control", "private, no-store");
    return errorResponse;
  }

  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "private, no-store");
  const client = createServerClient<Database>(supabaseUrl, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  });
  const flowId = url.searchParams.get("sb_flow_id");
  const { error } = await client.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
  if (error) {
    destination.searchParams.set("error", "Google sign-in expired or was already used. Please try again.");
    const errorResponse = NextResponse.redirect(destination);
    errorResponse.headers.set("Cache-Control", "private, no-store");
    return errorResponse;
  }
  return response;
}
