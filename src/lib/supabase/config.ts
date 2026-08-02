export type SupabaseRuntimeConfig = {
  url: string;
  publishableKey: string;
  secretKey?: string;
  projectRef: string;
};

export function getSupabaseRuntimeConfig(): SupabaseRuntimeConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) return null;
  const projectRef = new URL(url).hostname.split(".")[0] || "unknown";
  const secretKey = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  return { url, publishableKey, secretKey: secretKey || undefined, projectRef };
}

export function supabaseSetupState() {
  const config = getSupabaseRuntimeConfig();
  return {
    databaseConfigured: Boolean(config),
    serverWriteConfigured: Boolean(config?.secretKey),
    projectRef: config?.projectRef,
  };
}
