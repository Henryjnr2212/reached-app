/**
 * The one door the pages use to reach the backend. In production this is
 * Supabase (RPCs, phone OTP, the delete-account Edge Function). With
 * NEXT_PUBLIC_DEMO=1 it is the in-memory demo in lib/demo/, used for tests
 * and for previewing the site without a backend.
 */
import { DEMO_MODE } from './config';
import { demoBackend } from './demo/backend';
import { supabaseBackend } from './supabaseBackend';
import type { AdminStats, LiveResult, PoliceAlert, SignedInUser } from './types';

export interface Backend {
  readonly mode: 'demo' | 'supabase';
  getLive(token: string): Promise<LiveResult>;
  sendOtp(phoneE164: string): Promise<void>;
  /** Throws OtpError when the code is wrong or expired. */
  verifyOtp(phoneE164: string, code: string): Promise<SignedInUser>;
  currentUser(): Promise<SignedInUser | null>;
  signOut(): Promise<void>;
  /** Throws NotAllowedError for anyone who is not an approved officer. */
  policeFeed(): Promise<PoliceAlert[]>;
  /** Throws NotAllowedError for anyone who is not an admin. */
  adminStats(): Promise<AdminStats>;
  /** Deletes the signed-in account. Needs a sign-in from the last 10 minutes. */
  deleteAccount(): Promise<void>;
}

export { NotAllowedError, OtpError } from './errors';

/** null when neither demo mode nor Supabase env vars are set. */
export function getBackend(): Backend | null {
  if (DEMO_MODE) return demoBackend;
  return supabaseBackend();
}
