import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeGhanaPhone, type FeedbackKey, type LatLng, type PaymentMethod, type PlanId, type RuleEvent, type TripStatus } from '@reached/core';
import {
  BackendError,
  type ActivityEvent,
  type AppNotification,
  type Backend,
  type Contact,
  type ContactInput,
  type ContactRequest,
  type MessageRow,
  type OverdueAnswer,
  type Place,
  type PlaceInput,
  type PoliceStation,
  type Profile,
  type ProfilePatch,
  type Rule,
  type RuleInput,
  type SosAlert,
  type StartTripInput,
  type Subscription,
  type Trip,
} from './types';

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come back untyped from PostgREST and are mapped here */
type Row = Record<string, any>;

/** Friendly copy for the errors the database functions raise. */
const FRIENDLY: Record<string, string> = {
  no_contacts: 'Choose at least one person to tell.',
  bad_expected_time: 'Choose a time in the future.',
  trip_in_progress: 'Finish or cancel your current trip first.',
  contact_limit: "You've reached the contact limit on your plan.",
  place_limit: "You've reached the place limit on your plan.",
  sms_allowance: "You've used this month's SMS. WhatsApp contacts still get your messages.",
  trip_not_live: 'This trip has already ended.',
};

function fail(error: { message?: string; code?: string; hint?: string } | null): never {
  const raw = error?.message ?? 'unknown';
  const key = Object.keys(FRIENDLY).find((k) => raw.includes(k));
  throw new BackendError(key ?? error?.code ?? 'error', error?.hint ?? (key ? FRIENDLY[key]! : "Something went wrong. Try again."));
}

const point = (lat: unknown, lng: unknown): LatLng | null =>
  typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null;

export function mapProfile(r: Row): Profile {
  return {
    id: r.id,
    firstName: r.first_name,
    phone: r.phone,
    email: r.email,
    photoUri: r.photo_path,
    arrivalMode: r.arrival_mode,
    askTimeoutMin: r.ask_timeout_min,
    defaultMessage: r.default_message,
    graceMinutes: r.grace_minutes,
    autoDetect: r.auto_detect,
    headingOutPrompts: r.heading_out_prompts,
    sosHoldSeconds: r.sos_hold_seconds,
    sosCountdownSeconds: r.sos_countdown_seconds,
    alsoAlertPolice: r.also_alert_police,
    notifyArrivals: r.notify_arrivals,
    notifyRequests: r.notify_requests,
    notifyTips: r.notify_tips,
    retentionDays: r.retention_days,
    language: r.language,
    appearance: r.appearance,
    plan: r.plan,
    onboardedAt: r.onboarded_at,
  };
}

const PROFILE_COLUMNS: Record<keyof ProfilePatch, string> = {
  firstName: 'first_name',
  email: 'email',
  photoUri: 'photo_path',
  arrivalMode: 'arrival_mode',
  askTimeoutMin: 'ask_timeout_min',
  defaultMessage: 'default_message',
  graceMinutes: 'grace_minutes',
  autoDetect: 'auto_detect',
  headingOutPrompts: 'heading_out_prompts',
  sosHoldSeconds: 'sos_hold_seconds',
  sosCountdownSeconds: 'sos_countdown_seconds',
  alsoAlertPolice: 'also_alert_police',
  notifyArrivals: 'notify_arrivals',
  notifyRequests: 'notify_requests',
  notifyTips: 'notify_tips',
  retentionDays: 'retention_days',
  language: 'language',
  appearance: 'appearance',
  onboardedAt: 'onboarded_at',
};

export function mapContact(r: Row): Contact {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    relationship: r.relationship,
    channel: r.channel,
    language: r.language,
    isDefault: r.is_default,
    isEmergency: r.is_emergency,
    canRequestLocation: r.can_request_location,
    optedOut: r.opted_out_at != null,
    lastFailedAt: r.last_failed_at,
    createdAt: r.created_at,
  };
}

export function mapPlace(r: Row): Place {
  return { id: r.id, name: r.name, icon: r.icon, lat: r.lat, lng: r.lng, radius: r.radius_m, address: r.address, ghanaPostGps: r.ghanapost_gps };
}

const placeRow = (p: Partial<PlaceInput>) => {
  const out: Row = {};
  if (p.name !== undefined) out.name = p.name;
  if (p.icon !== undefined) out.icon = p.icon;
  if (p.lat !== undefined) out.lat = p.lat;
  if (p.lng !== undefined) out.lng = p.lng;
  if (p.radius !== undefined) out.radius_m = p.radius;
  if (p.address !== undefined) out.address = p.address;
  if (p.ghanaPostGps !== undefined) out.ghanapost_gps = p.ghanaPostGps;
  return out;
};

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

export function mapRule(r: Row): Rule {
  return {
    id: r.id,
    placeId: r.place_id,
    event: r.event,
    contactIds: (r.rule_contacts ?? []).map((c: Row) => c.contact_id),
    days: r.days,
    windowStart: hhmm(r.window_start),
    windowEnd: hhmm(r.window_end),
    message: r.message,
    enabled: r.enabled,
  };
}

export function mapTrip(r: Row): Trip {
  return {
    id: r.id,
    placeId: r.place_id,
    destName: r.dest_name,
    dest: point(r.dest_lat, r.dest_lng),
    radius: r.radius_m,
    status: r.status,
    startedAt: r.started_at,
    expectedAt: r.expected_at,
    graceMinutes: r.grace_minutes,
    checkOnMe: r.check_on_me,
    overduePromptedAt: r.overdue_prompted_at,
    contactIds: (r.trip_contacts ?? []).map((c: Row) => c.contact_id),
    liveToken: r.live_token,
    lastCheckinAt: r.last_checkin_at,
    last: point(r.last_lat, r.last_lng),
    transportType: r.transport_type,
    plate: r.plate,
    platePhotoUri: r.plate_photo_path,
    driverName: r.driver_name,
    car: r.car,
    rideProvider: r.ride_provider,
    rideLink: r.ride_link,
  };
}

function mapMessage(r: Row): MessageRow {
  return {
    id: r.id,
    contactId: r.contact_id,
    contactName: r.contact_name,
    channel: r.channel,
    status: r.status,
    body: r.body,
    failureReason: r.failure_reason,
    createdAt: r.created_at,
  };
}

export function mapEvent(r: Row): ActivityEvent {
  const messages = ((r.messages ?? []) as Row[]).map(mapMessage).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    placeName: r.place_name,
    point: point(r.lat, r.lng),
    createdAt: r.created_at,
    feedback: r.feedback,
    tripId: r.trip_id,
    messages,
    previewBody: messages.find((m) => m.body)?.body ?? null,
  };
}

function mapSos(r: Row): SosAlert {
  return { id: r.id, status: r.status, sentAt: r.sent_at, liveToken: r.live_token };
}

function mapSubscription(r: Row): Subscription {
  return {
    id: r.id,
    plan: r.plan,
    status: r.status,
    providerRef: r.provider_ref,
    amountGhs: Number(r.amount_ghs),
    currentPeriodEnd: r.current_period_end,
  };
}

const TRIP_SELECT = '*, trip_contacts(contact_id)';
const EVENT_SELECT = '*, messages(id, contact_id, contact_name, channel, status, body, failure_reason, created_at)';

/** Production backend: Supabase Auth (phone OTP), PostgREST and RPCs. */
export class SupabaseBackend implements Backend {
  readonly kind = 'supabase' as const;
  readonly client: SupabaseClient;

  constructor(url: string, anonKey: string, client?: SupabaseClient) {
    this.client =
      client ??
      createClient(url, anonKey, {
        auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
      });
  }

  private async rpc<T = any>(fn: string, args: Row = {}): Promise<T> {
    const { data, error } = await this.client.rpc(fn, args);
    if (error) fail(error);
    return data as T;
  }

  private async uid(): Promise<string> {
    const id = await this.getSessionUserId();
    if (!id) throw new BackendError('signed_out', 'Please sign in again.');
    return id;
  }

  private async invoke<T = any>(name: string, body: Row): Promise<T> {
    const { data, error } = await this.client.functions.invoke(name, { body });
    if (error) {
      let detail: Row | null = null;
      try {
        detail = await (error as any).context?.json?.();
      } catch {
        detail = null;
      }
      throw new BackendError(detail?.error ?? 'function_error', detail?.message ?? "Something went wrong. Try again.");
    }
    return data as T;
  }

  // Auth -------------------------------------------------------------------

  async getSessionUserId() {
    const { data } = await this.client.auth.getSession();
    return data.session?.user.id ?? null;
  }

  async sendOtp(phone: string) {
    const e164 = normalizeGhanaPhone(phone);
    if (!e164) throw new BackendError('bad_phone', 'Enter a Ghana mobile number, like 024 123 4567.');
    const { error } = await this.client.auth.signInWithOtp({ phone: e164 });
    if (error) throw new BackendError('otp_failed', "We couldn't send the code. Check the number and try again.");
  }

  async verifyOtp(phone: string, code: string) {
    const e164 = normalizeGhanaPhone(phone);
    if (!e164) throw new BackendError('bad_phone', 'Enter a Ghana mobile number.');
    const { error } = await this.client.auth.verifyOtp({ phone: e164, token: code, type: 'sms' });
    if (error) throw new BackendError('bad_code', "That code isn't right.");
    const profile = await this.getProfile();
    return { isNew: !profile.onboardedAt };
  }

  async startPhoneChange(phone: string) {
    const e164 = normalizeGhanaPhone(phone);
    if (!e164) throw new BackendError('bad_phone', 'Enter a Ghana mobile number, like 024 123 4567.');
    const { error } = await this.client.auth.updateUser({ phone: e164 });
    if (error) throw new BackendError('otp_failed', "We couldn't send the code. Check the number and try again.");
  }

  async confirmPhoneChange(phone: string, code: string) {
    const e164 = normalizeGhanaPhone(phone);
    if (!e164) throw new BackendError('bad_phone', 'Enter a Ghana mobile number.');
    // The profile's phone follows auth.users through the on_auth_user_phone_changed trigger.
    const { error } = await this.client.auth.verifyOtp({ phone: e164, token: code, type: 'phone_change' });
    if (error) throw new BackendError('bad_code', "That code isn't right.");
  }

  async signOut() {
    await this.client.auth.signOut();
  }

  // Profile ----------------------------------------------------------------

  async getProfile() {
    const id = await this.uid();
    const { data, error } = await this.client.from('profiles').select('*').eq('id', id).single();
    if (error) fail(error);
    return mapProfile(data);
  }

  async updateProfile(patch: ProfilePatch) {
    const id = await this.uid();
    const row: Row = {};
    for (const [k, v] of Object.entries(patch)) {
      const col = PROFILE_COLUMNS[k as keyof ProfilePatch];
      if (col) row[col] = v;
    }
    const { data, error } = await this.client.from('profiles').update(row).eq('id', id).select('*').single();
    if (error) fail(error);
    return mapProfile(data);
  }

  // Contacts ---------------------------------------------------------------

  async listContacts() {
    const { data, error } = await this.client.from('contacts').select('*').order('created_at');
    if (error) fail(error);
    return (data ?? []).map(mapContact);
  }

  async addContact(input: ContactInput) {
    const phone = normalizeGhanaPhone(input.phone);
    if (!phone) throw new BackendError('bad_phone', 'Enter a Ghana mobile number.');
    const { data, error } = await this.client
      .from('contacts')
      .insert({
        name: input.name.trim(),
        phone,
        relationship: input.relationship,
        channel: input.channel,
        is_default: input.isDefault ?? true,
        is_emergency: input.isEmergency ?? true,
      })
      .select('*')
      .single();
    if (error?.code === '23505') throw new BackendError('duplicate', 'This person is already in your contacts.');
    if (error) fail(error);
    return mapContact(data);
  }

  async updateContact(id: string, patch: Partial<ContactInput> & { language?: Contact['language']; canRequestLocation?: boolean }) {
    const row: Row = {};
    if (patch.name !== undefined) row.name = patch.name.trim();
    if (patch.phone !== undefined) {
      const phone = normalizeGhanaPhone(patch.phone);
      if (!phone) throw new BackendError('bad_phone', 'Enter a Ghana mobile number.');
      row.phone = phone;
    }
    if (patch.relationship !== undefined) row.relationship = patch.relationship;
    if (patch.channel !== undefined) row.channel = patch.channel;
    if (patch.isDefault !== undefined) row.is_default = patch.isDefault;
    if (patch.isEmergency !== undefined) row.is_emergency = patch.isEmergency;
    if (patch.language !== undefined) row.language = patch.language;
    if (patch.canRequestLocation !== undefined) row.can_request_location = patch.canRequestLocation;
    const { data, error } = await this.client.from('contacts').update(row).eq('id', id).select('*').single();
    if (error) fail(error);
    return mapContact(data);
  }

  async removeContact(id: string) {
    const { error } = await this.client.from('contacts').delete().eq('id', id);
    if (error) fail(error);
  }

  async sendTestMessage(contactId: string) {
    return this.rpc<string>('send_test_message', { p_contact_id: contactId });
  }

  // Places and rules -------------------------------------------------------

  async listPlaces() {
    const { data, error } = await this.client.from('places').select('*').order('created_at');
    if (error) fail(error);
    return (data ?? []).map(mapPlace);
  }

  async addPlace(input: PlaceInput) {
    const { data, error } = await this.client.from('places').insert(placeRow(input)).select('*').single();
    if (error) fail(error);
    return mapPlace(data);
  }

  async updatePlace(id: string, input: Partial<PlaceInput>) {
    const { data, error } = await this.client.from('places').update(placeRow(input)).eq('id', id).select('*').single();
    if (error) fail(error);
    return mapPlace(data);
  }

  async removePlace(id: string) {
    const { error } = await this.client.from('places').delete().eq('id', id);
    if (error) fail(error);
  }

  async listRules() {
    const { data, error } = await this.client.from('rules').select('*, rule_contacts(contact_id)').order('created_at');
    if (error) fail(error);
    return (data ?? []).map(mapRule);
  }

  async saveRule(rule: RuleInput) {
    const row = {
      place_id: rule.placeId,
      event: rule.event,
      days: rule.days,
      window_start: rule.windowStart,
      window_end: rule.windowEnd,
      message: rule.message,
      enabled: rule.enabled,
    };
    const q = rule.id
      ? this.client.from('rules').update(row).eq('id', rule.id).select('id').single()
      : this.client.from('rules').insert(row).select('id').single();
    const { data, error } = await q;
    if (error) fail(error);
    const id = (data as Row).id as string;
    const del = await this.client.from('rule_contacts').delete().eq('rule_id', id);
    if (del.error) fail(del.error);
    if (rule.contactIds.length) {
      const ins = await this.client.from('rule_contacts').insert(rule.contactIds.map((c) => ({ rule_id: id, contact_id: c })));
      if (ins.error) fail(ins.error);
    }
    return { ...rule, id };
  }

  async deleteRule(id: string) {
    const { error } = await this.client.from('rules').delete().eq('id', id);
    if (error) fail(error);
  }

  async reportPlaceEvent(placeId: string, event: RuleEvent, at?: LatLng | null) {
    return this.rpc<string | null>('report_place_event', { p_place_id: placeId, p_event: event, p_lat: at?.lat ?? null, p_lng: at?.lng ?? null });
  }

  async reportAutoArrival(area: string, at: LatLng) {
    return this.rpc<string | null>('report_auto_arrival', { p_area: area, p_lat: at.lat, p_lng: at.lng });
  }

  // Trips ------------------------------------------------------------------

  async getLiveTrip() {
    const { data, error } = await this.client
      .from('trips')
      .select(TRIP_SELECT)
      .in('status', ['active', 'overdue', 'alerted'])
      .maybeSingle();
    if (error) fail(error);
    return data ? mapTrip(data) : null;
  }

  private async tripById(id: string): Promise<Trip> {
    const { data, error } = await this.client.from('trips').select(TRIP_SELECT).eq('id', id).single();
    if (error) fail(error);
    return mapTrip(data);
  }

  async startTrip(input: StartTripInput) {
    const p: Row = {
      place_id: input.placeId ?? null,
      dest_name: input.destName ?? null,
      dest_lat: input.dest?.lat ?? null,
      dest_lng: input.dest?.lng ?? null,
      radius_m: input.radius ?? null,
      contact_ids: input.contactIds,
      message: input.message ?? null,
      contact_messages: input.contactMessages ?? {},
      tell_leaving: input.tellLeaving,
      check_on_me: input.checkOnMe,
      expected_at: input.expectedAt,
      grace_minutes: input.graceMinutes,
      here_lat: input.here?.lat ?? null,
      here_lng: input.here?.lng ?? null,
      source: input.source ?? 'manual',
      transport_type: input.transportType ?? null,
      plate: input.plate ?? null,
      plate_photo_path: input.platePhotoUri ?? null,
      driver_name: input.driverName ?? null,
      car: input.car ?? null,
      ride_provider: input.rideProvider ?? null,
      ride_link: input.rideLink ?? null,
    };
    const row = await this.rpc<Row>('start_trip', { p });
    return this.tripById(row.id);
  }

  async arriveTrip(tripId: string, at?: LatLng | null, source: 'manual' | 'auto' = 'manual') {
    return this.rpc<string>('arrive_trip', { p_trip_id: tripId, p_lat: at?.lat ?? null, p_lng: at?.lng ?? null, p_source: source });
  }

  async extendTrip(tripId: string, minutes: number, tell: boolean) {
    await this.rpc('extend_trip', { p_trip_id: tripId, p_minutes: minutes, p_tell: tell });
    return this.tripById(tripId);
  }

  async cancelTrip(tripId: string, tell: boolean) {
    await this.rpc('cancel_trip', { p_trip_id: tripId, p_tell: tell });
  }

  async checkin(tripId: string, at: LatLng, accuracy?: number | null, battery?: number | null) {
    return this.rpc<TripStatus>('trip_checkin', {
      p_trip_id: tripId,
      p_lat: at.lat,
      p_lng: at.lng,
      p_accuracy: accuracy ?? null,
      p_battery: battery ?? null,
    });
  }

  async respondOverdue(tripId: string, answer: OverdueAnswer, minutes?: number) {
    const r = await this.rpc<Row>('respond_overdue', { p_trip_id: tripId, p_answer: answer, p_minutes: minutes ?? null });
    return { eventId: r?.event_id ?? undefined, sosId: r?.sos_id ?? undefined };
  }

  // Activity ---------------------------------------------------------------

  async listEvents() {
    const { data, error } = await this.client.from('events').select(EVENT_SELECT).order('created_at', { ascending: false }).limit(200);
    if (error) fail(error);
    return (data ?? []).map(mapEvent);
  }

  async getEvent(id: string) {
    const { data, error } = await this.client.from('events').select(EVENT_SELECT).eq('id', id).maybeSingle();
    if (error) fail(error);
    return data ? mapEvent(data) : null;
  }

  async resendMessage(messageId: string) {
    await this.rpc('resend_message', { p_message_id: messageId });
  }

  async eventFeedback(eventId: string, feedback: FeedbackKey) {
    await this.rpc('event_feedback', { p_event_id: eventId, p_feedback: feedback });
  }

  async confirmEvent(eventId: string, send: boolean) {
    await this.rpc('confirm_event', { p_event_id: eventId, p_send: send });
  }

  async sendReachedNow(contactIds: string[], area: string, at?: LatLng | null) {
    return this.rpc<string>('send_reached_now', { p_contact_ids: contactIds, p_area: area, p_lat: at?.lat ?? null, p_lng: at?.lng ?? null });
  }

  async runSelfTest() {
    return this.rpc<string>('run_self_test');
  }

  // Safety -----------------------------------------------------------------

  async getOpenSos() {
    const { data, error } = await this.client.from('sos_alerts').select('*').eq('status', 'sent').maybeSingle();
    if (error) fail(error);
    return data ? mapSos(data) : null;
  }

  async triggerSos(at: LatLng | null, battery: number | null, trigger = 'shield') {
    const row = await this.rpc<Row>('trigger_sos', { p_lat: at?.lat ?? null, p_lng: at?.lng ?? null, p_battery: battery, p_trigger: trigger });
    return mapSos(row);
  }

  async sosPing(sosId: string, at: LatLng, battery: number | null) {
    await this.rpc('sos_ping', { p_sos_id: sosId, p_lat: at.lat, p_lng: at.lng, p_battery: battery });
  }

  async imSafe() {
    return this.rpc<string>('im_safe');
  }

  // Notifications and requests --------------------------------------------

  async listNotifications() {
    const { data, error } = await this.client.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
    if (error) fail(error);
    return (data ?? []).map(
      (r: Row): AppNotification => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, data: r.data ?? {}, createdAt: r.created_at, readAt: r.read_at }),
    );
  }

  async markNotificationRead(id: string) {
    const { error } = await this.client.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    if (error) fail(error);
  }

  async registerPushToken(token: string, platform: 'android' | 'ios' | 'web') {
    const user_id = await this.uid();
    const { error } = await this.client.from('push_tokens').upsert({ user_id, token, platform }, { onConflict: 'token' });
    if (error) fail(error);
  }

  async listRequests() {
    const { data, error } = await this.client
      .from('contact_requests')
      .select('id, contact_id, status, created_at, contacts(name)')
      .in('status', ['pending', 'expired'])
      .order('created_at', { ascending: false });
    if (error) fail(error);
    return (data ?? []).map(
      (r: Row): ContactRequest => ({ id: r.id, contactId: r.contact_id, contactName: r.contacts?.name ?? 'Someone', status: r.status, createdAt: r.created_at }),
    );
  }

  async respondRequest(id: string, accept: boolean, trip?: Partial<StartTripInput> | null) {
    const p_trip = trip
      ? {
          place_id: trip.placeId ?? null,
          dest_name: trip.destName ?? null,
          check_on_me: trip.checkOnMe ?? false,
          expected_at: trip.expectedAt ?? null,
          grace_minutes: trip.graceMinutes ?? null,
          tell_leaving: trip.tellLeaving ?? false,
        }
      : null;
    await this.rpc('respond_contact_request', { p_request_id: id, p_accept: accept, p_trip });
  }

  // Privacy ----------------------------------------------------------------

  async deleteActivity() {
    await this.rpc('delete_my_activity');
  }

  async exportData() {
    return this.rpc('export_my_data');
  }

  async deleteAccount(code: string) {
    const profile = await this.getProfile();
    await this.verifyOtp(profile.phone, code);
    await this.invoke('delete-account', {});
    await this.client.auth.signOut().catch(() => undefined);
  }

  // Phase 2/3 --------------------------------------------------------------

  async lookupGhanaPost(code: string) {
    try {
      const r = await this.invoke<Row>('geocode', { code });
      return { lat: r.lat, lng: r.lng, address: r.address ?? r.code };
    } catch (e) {
      if (e instanceof BackendError && e.code === 'not_found') return null;
      throw e;
    }
  }

  async nearestPolice(at: LatLng) {
    const rows = await this.rpc<Row[]>('nearest_police_stations', { p_lat: at.lat, p_lng: at.lng, p_limit: 5 });
    return (rows ?? []).map(
      (r): PoliceStation => ({
        id: r.id,
        name: r.name,
        region: r.region,
        district: r.district,
        phone: r.phone,
        verified: r.verified,
        lat: r.lat,
        lng: r.lng,
        distanceM: r.distance_m,
      }),
    );
  }

  async startSubscription(plan: Exclude<PlanId, 'free'>, method: PaymentMethod, payPhone: string | null) {
    const phone = payPhone ? normalizeGhanaPhone(payPhone) : null;
    const row = await this.rpc<Row>('start_subscription', { p_plan: plan, p_method: method, p_pay_phone: phone });
    await this.invoke('payments/charge', { subscription_ref: row.provider_ref });
    return this.confirmPayment(row.provider_ref);
  }

  async confirmPayment(providerRef: string) {
    const { data, error } = await this.client.from('subscriptions').select('*').eq('provider_ref', providerRef).single();
    if (error) fail(error);
    return mapSubscription(data);
  }

  async reportProblem(body: string, logs: string | null) {
    const user_id = await this.uid();
    const { error } = await this.client.from('problem_reports').insert({ user_id, body, logs });
    if (error) fail(error);
  }
}
