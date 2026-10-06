import { createClient } from '@supabase/supabase-js';
import type { DbClient, Env } from './db.ts';

/**
 * Service-role client built from SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * (both injected automatically by the Supabase Edge Runtime). It bypasses RLS,
 * so it is only ever used server-side inside these functions.
 */
export function serviceClient(env: Env = Deno.env.toObject()): DbClient {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client as unknown as DbClient;
}

/** Hand background work to the Edge Runtime so the response can go out first. */
export function backgroundRunner(): ((work: Promise<unknown>) => void) | undefined {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  return runtime ? (work) => runtime.waitUntil(work) : undefined;
}
