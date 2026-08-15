"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let browserClient: SupabaseClient<Database> | null | undefined;

export function getBrowserSupabaseClient(): SupabaseClient<Database> | null {
  if (browserClient !== undefined) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  browserClient = url && publishableKey
    ? createBrowserClient<Database>(url, publishableKey)
    : null;
  return browserClient;
}

export function isPermanentRankedUser(user: User | null): user is User {
  return Boolean(user && user.is_anonymous !== true);
}

export async function getRankedUser(client: SupabaseClient<Database>): Promise<User | null> {
  const { data, error } = await client.auth.getUser();
  if (error && !error.message.toLocaleLowerCase().includes("session")) throw error;
  return data.user ?? null;
}

export async function requirePermanentRankedUser(client: SupabaseClient<Database>): Promise<User> {
  const user = await getRankedUser(client);
  if (!isPermanentRankedUser(user)) throw new Error("Sign in with a permanent account to publish or contribute to consensus.");
  return user;
}

export async function signInToRankedWithGoogle(client: SupabaseClient<Database>): Promise<void> {
  const callback = new URL("/auth/callback", window.location.origin);
  const currentPath = `${window.location.pathname}${window.location.search}`;
  try {
    window.sessionStorage.setItem("ranked:auth:returnTo", currentPath.startsWith("/") ? currentPath : "/create");
  } catch {}
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback.toString() },
  });
  if (error) throw error;
}
