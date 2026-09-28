const hasSupabaseCredentials = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== "false" || !hasSupabaseCredentials;

export const isSupabaseConfigured = !isDemoMode && hasSupabaseCredentials;
