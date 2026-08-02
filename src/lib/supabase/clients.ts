import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabaseRuntimeConfig } from "./config";

export function createPublicSupabaseClient(): SupabaseClient<Database> | null {
  const config = getSupabaseRuntimeConfig();
  if (!config) return null;
  return createClient<Database>(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function createAdminSupabaseClient(): SupabaseClient<Database> | null {
  const config = getSupabaseRuntimeConfig();
  if (!config?.secretKey) return null;
  return createClient<Database>(config.url, config.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
