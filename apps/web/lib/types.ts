/** Shapes returned by the Supabase RPCs (see supabase/migrations). */

export interface LiveDetails {
  transport: string | null;
  plate: string | null;
  driver: string | null;
  car: string | null;
  ride_link: string | null;
  ride_provider: string | null;
  has_plate_photo: boolean;
}

export type TripStatus = 'active' | 'overdue' | 'alerted' | 'arrived' | 'cancelled';

export interface LiveOk {
  state: 'live';
  kind: 'trip' | 'sos';
  emergency: boolean;
  cleared: boolean;
  name: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  updated_at: string | null;
  battery_pct: number | null;
  trip_status: TripStatus | null;
  destination: string | null;
  expected_at: string | null;
  details: LiveDetails | null;
}

export type LiveResult = LiveOk | { state: 'ended'; name?: string | null } | { state: 'not_found' };

/** One row of police_feed(). */
export interface PoliceAlert {
  sos_id: string;
  status: 'sent' | 'cleared';
  sent_at: string;
  cleared_at: string | null;
  first_name: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  last_ping_at: string | null;
  battery_pct: number | null;
  destination: string | null;
  transport_type: string | null;
  plate: string | null;
  driver_name: string | null;
  car: string | null;
  ride_link: string | null;
  plate_photo_path: string | null;
}

/** admin_stats() — counts only, no personal data. */
export interface AdminStats {
  users: number;
  onboarded: number;
  plans: Record<string, number>;
  live_trips: number;
  open_sos: number;
  messages_7d: Record<string, number>;
  arrivals_7d: number;
  feedback_7d: Record<string, number>;
  problem_reports_7d: number;
}

export interface SignedInUser {
  id: string;
  phone: string;
}
