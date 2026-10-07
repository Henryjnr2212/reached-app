/**
 * DEMO ONLY — in-memory stand-in for Supabase, used when NEXT_PUBLIC_DEMO=1
 * (Playwright tests and local previews). Nothing here talks to a network and
 * none of it is used by the real code paths in lib/supabaseBackend.ts.
 *
 * Live links:  demoLive1 (on the way) · demoSos01 (emergency) ·
 *              demoClr01 (cleared) · demoEnd01 (ended) · anything else → not found
 * Sign-in:     any Ghana mobile number, code 123456
 *              020 000 0001 → approved police officer
 *              020 000 0002 → admin
 *              020 000 0003 → police officer awaiting approval
 */
import type { Backend } from '../backend';
import { NotAllowedError, OtpError } from '../errors';
import type { AdminStats, LiveOk, LiveResult, PoliceAlert, SignedInUser } from '../types';

export const DEMO_OTP = '123456';
export const DEMO_POLICE_PHONE = '+233200000001';
export const DEMO_ADMIN_PHONE = '+233200000002';
export const DEMO_PENDING_OFFICER_PHONE = '+233200000003';

const AMA_PHONE = '+233241234567';

/** Today at hh:mm Accra time (= UTC). */
function todayAt(h: number, m: number): string {
  const d = new Date();
  d.setUTCHours(h, m, 0, 0);
  return d.toISOString();
}

function ago(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

const base = (): LiveOk => ({
  state: 'live',
  kind: 'trip',
  emergency: false,
  cleared: false,
  name: 'Ama',
  phone: AMA_PHONE,
  lat: 5.6037,
  lng: -0.187,
  updated_at: ago(60_000),
  battery_pct: 64,
  trip_status: 'active',
  destination: 'Work',
  expected_at: todayAt(18, 30),
  details: null,
});

export function demoLive(token: string): LiveResult {
  switch (token) {
    case 'demoLive1':
      return base();
    case 'demoSos01':
      return {
        ...base(),
        kind: 'sos',
        emergency: true,
        trip_status: 'alerted',
        battery_pct: 23,
        updated_at: ago(20_000),
        lat: 5.5913,
        lng: -0.2213,
        details: {
          transport: 'ride',
          plate: 'GR 2214-23',
          driver: 'Kwame',
          car: 'Silver Toyota Vitz',
          ride_link: 'https://example.com/ride/demo',
          ride_provider: 'Bolt',
          has_plate_photo: true,
        },
      };
    case 'demoClr01':
      return { ...base(), kind: 'sos', cleared: true, trip_status: null, destination: null, expected_at: null };
    case 'demoEnd01':
      return { state: 'ended', name: 'Ama' };
    default:
      return { state: 'not_found' };
  }
}

function demoPoliceFeed(): PoliceAlert[] {
  return [
    {
      sos_id: 'demo-sos-1',
      status: 'sent',
      sent_at: ago(4 * 60_000),
      cleared_at: null,
      first_name: 'Ama',
      phone: AMA_PHONE,
      lat: 5.5913,
      lng: -0.2213,
      last_ping_at: ago(25_000),
      battery_pct: 23,
      destination: 'Work',
      transport_type: 'ride',
      plate: 'GR 2214-23',
      driver_name: 'Kwame',
      car: 'Silver Toyota Vitz',
      ride_link: 'https://example.com/ride/demo',
      plate_photo_path: 'plates/demo.jpg',
    },
    {
      sos_id: 'demo-sos-2',
      status: 'cleared',
      sent_at: ago(52 * 60_000),
      cleared_at: ago(47 * 60_000),
      first_name: 'Kofi',
      phone: '+233201112233',
      lat: 5.6502,
      lng: -0.1869,
      last_ping_at: ago(47 * 60_000),
      battery_pct: 81,
      destination: null,
      transport_type: null,
      plate: null,
      driver_name: null,
      car: null,
      ride_link: null,
      plate_photo_path: null,
    },
  ];
}

const DEMO_STATS: AdminStats = {
  users: 1284,
  onboarded: 1102,
  plans: { free: 1015, premium: 241, family: 28 },
  live_trips: 37,
  open_sos: 1,
  messages_7d: { delivered: 5210, sent: 312, failed: 41, opted_out: 6, pending: 3 },
  arrivals_7d: 4875,
  feedback_7d: { not_arrived: 12, wrong_place: 7, should_not_send: 4 },
  problem_reports_7d: 9,
};

let user: SignedInUser | null = null;
let codeSentTo: string | null = null;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const demoBackend: Backend = {
  mode: 'demo',
  async getLive(token) {
    await wait(50);
    return demoLive(token);
  },
  async sendOtp(phone) {
    await wait(50);
    codeSentTo = phone;
  },
  async verifyOtp(phone, code) {
    await wait(50);
    if (phone !== codeSentTo || code !== DEMO_OTP) throw new OtpError();
    user = { id: `demo-${phone.slice(-4)}`, phone };
    return user;
  },
  async currentUser() {
    return user;
  },
  async signOut() {
    user = null;
    codeSentTo = null;
  },
  async policeFeed() {
    await wait(50);
    if (user?.phone !== DEMO_POLICE_PHONE) throw new NotAllowedError();
    return demoPoliceFeed();
  },
  async adminStats() {
    await wait(50);
    if (user?.phone !== DEMO_ADMIN_PHONE) throw new NotAllowedError();
    return DEMO_STATS;
  },
  async deleteAccount() {
    await wait(50);
    if (!user) throw new Error('not_signed_in');
    user = null;
    codeSentTo = null;
  },
};
