import type { Backend } from './backend';
import { NotAllowedError, OtpError } from './errors';
import { getSupabase } from './supabase';
import type { AdminStats, LiveResult, PoliceAlert, SignedInUser } from './types';

interface PgError {
  code?: string;
  message?: string;
}

function isPermissionError(e: PgError | null): boolean {
  return !!e && (e.code === '42501' || /not_police|not_admin|permission denied/i.test(e.message ?? ''));
}

export function supabaseBackend(): Backend | null {
  const sb = getSupabase();
  if (!sb) return null;

  return {
    mode: 'supabase',

    async getLive(token) {
      const { data, error } = await sb.rpc('get_live', { p_token: token });
      if (error) throw new Error(error.message);
      return (data ?? { state: 'not_found' }) as LiveResult;
    },

    async sendOtp(phone) {
      const { error } = await sb.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } });
      if (error) throw new Error(error.message);
    },

    async verifyOtp(phone, code) {
      const { data, error } = await sb.auth.verifyOtp({ phone, token: code, type: 'sms' });
      if (error || !data.user) throw new OtpError(error?.message);
      return { id: data.user.id, phone: data.user.phone ? `+${data.user.phone.replace(/^\+/, '')}` : phone };
    },

    async currentUser(): Promise<SignedInUser | null> {
      const { data } = await sb.auth.getUser();
      if (!data.user) return null;
      return { id: data.user.id, phone: `+${(data.user.phone ?? '').replace(/^\+/, '')}` };
    },

    async signOut() {
      await sb.auth.signOut();
    },

    async policeFeed() {
      const { data, error } = await sb.rpc('police_feed');
      if (isPermissionError(error)) throw new NotAllowedError();
      if (error) throw new Error(error.message);
      return (data ?? []) as PoliceAlert[];
    },

    async adminStats() {
      const { data, error } = await sb.rpc('admin_stats');
      if (isPermissionError(error)) throw new NotAllowedError();
      if (error) throw new Error(error.message);
      return data as AdminStats;
    },

    async deleteAccount() {
      // The function checks that the JWT was issued within the last 10 minutes,
      // which is why the page always asks for a fresh code first.
      const { error } = await sb.functions.invoke('delete-account', { method: 'POST', body: { confirm: true } });
      if (error) throw new Error(error.message);
      await sb.auth.signOut({ scope: 'local' });
    },
  };
}
