import { NextResponse, type NextRequest } from "next/server";
import { completeRankedOAuthSignIn } from "@/lib/supabase/authCallback";

export async function GET(request: NextRequest, { params }: { params: Promise<{ callback: string[] }> }) {
  const { callback } = await params;
  if (callback.join("/") === "callback**") return completeRankedOAuthSignIn(request);
  return NextResponse.redirect(new URL("/", request.url));
}
