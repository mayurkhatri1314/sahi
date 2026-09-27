import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const hasSupabase = Boolean(url && anon);

/** Read-only client for the app (anon key). Returns null if Supabase isn't configured. */
export function publicClient(): SupabaseClient | null {
  return hasSupabase ? createClient(url!, anon!) : null;
}

/** Privileged client for the ingest job (service role). Server-only. */
export function serviceClient(): SupabaseClient | null {
  return url && service ? createClient(url, service) : null;
}
