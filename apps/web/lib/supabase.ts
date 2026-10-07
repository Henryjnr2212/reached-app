import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/** Browser Supabase client using the anon key, or null when env vars are missing. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'reached-web-auth' },
    });
  }
  return client;
}
