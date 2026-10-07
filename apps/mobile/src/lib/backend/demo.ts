import {
  ACCRA,
  DEFAULT_GRACE_MIN,
  dueAt,
  extendExpected,
  formatClock,
  isDuplicateTrigger,
  matchingDeliveries,
  MINUTE,
  nearestStations,
  normalizeGhanaPhone,
  normalizeGhanaPostGps,
  overdueAction,
  OVERDUE_RESPONSE_MIN,
  phoneMayBeOff,
  PLANS,
  renderCustom,
  renderSms,
  type FeedbackKey,
  type LatLng,
  type MessageParams,
  type PaymentMethod,
  type PlanId,
  type RuleEvent,
  type TemplateKey,
  type TripStatus,
} from '@reached/core';
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

/**
 * In-memory backend that follows the same rules as the database functions
 * (supabase/migrations/*_functions.sql), using @reached/core for templates,
 * rule matching, duplicate suppression and overdue timing. Used for the web
 * preview and the Playwright e2e flows. OTP is always 123456.
 *
 * Contacts whose number ends in 0000 simulate a failed delivery.
 */
export const DEMO_OTP = '123456';

interface DemoEvent extends Omit<ActivityEvent, 'messages' | 'previewBody'> {
  placeId: string | null;
  autoSendAt: number | null;
  sosId: string | null;
}

interface DemoMessage extends MessageRow {
  eventId: string;
  template: TemplateKey | 'custom';
  params: MessageParams & { custom?: string };
  toPhone: string;
  isSafety: boolean;
}

interface State {
  userId: string | null;
  pendingPhone: string | null;
  profile: Profile | null;
  contacts: Contact[];
  places: Place[];
  rules: Rule[];
  trips: Trip[];
  events: DemoEvent[];
  messages: DemoMessage[];
  notifications: AppNotification[];
  sos: (SosAlert & { tripId: string | null })[];
  requests: ContactRequest[];
  subscriptions: Subscription[];
  clockOffsetMs: number;
}

const STORAGE_KEY = 'reached-demo-v1';

const POLICE: Omit<PoliceStation, 'distanceM'>[] = [
  { id: 'p1', name: 'Osu Police Station', region: 'Greater Accra', district: 'Korle Klottey', phone: null, verified: false, lat: 5.556, lng: -0.18 },
  { id: 'p2', name: 'Airport Police Station', region: 'Greater Accra', district: 'Ayawaso West', phone: null, verified: false, lat: 5.604, lng: -0.172 },
  { id: 'p3', name: 'Accra Central Police Station', region: 'Greater Accra', district: 'Accra Metropolitan', phone: null, verified: false, lat: 5.548, lng: -0.205 },
  { id: 'p4', name: 'Madina Police Station', region: 'Greater Accra', district: 'La Nkwantanang Madina', phone: null, verified: false, lat: 5.669, lng: -0.166 },
  { id: 'p5', name: 'East Legon Police Station', region: 'Greater Accra', district: 'Ayawaso West', phone: null, verified: false, lat: 5.637, lng: -0.16 },
];

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function token(): string {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from({ length: 8 }, () => a[Math.floor(Math.random() * a.length)]).join('');
}

function emptyState(): State {
  return {
    userId: null,
    pendingPhone: null,
    profile: null,
    contacts: [],
    places: [],
    rules: [],
    trips: [],
    events: [],
    messages: [],
    notifications: [],
    sos: [],
    requests: [],
    subscriptions: [],
    clockOffsetMs: 0,
  };
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export class DemoBackend implements Backend {
  readonly kind = 'demo' as const;
  private s: State;
  private listeners = new Set<() => void>();
  private timers: ReturnType<typeof setTimeout>[] = [];
  private ticker: ReturnType<typeof setInterval> | null = null;
  /** Delivery simulation delays (ms). Tests set these to 0. */
  sendDelayMs = 700;
  deliverDelayMs = 1600;

  constructor(opts: { persist?: boolean; tick?: boolean } = {}) {
    const persist = opts.persist ?? true;
    const raw = persist ? storage()?.getItem(STORAGE_KEY) : null;
    this.s = raw ? (JSON.parse(raw) as State) : emptyState();
    this.persist = persist;
    if (opts.tick ?? true) this.ticker = setInterval(() => this.tick(), 1000);
    // Resume simulated deliveries interrupted by a reload.
    for (const m of this.s.messages) {
      if (m.status === 'pending' || m.status === 'sending') this.deliver(m);
      else if (m.status === 'sent') {
        this.timers.push(
          setTimeout(() => {
            if (m.status === 'sent') {
              m.status = 'delivered';
              this.changed();
            }
          }, this.deliverDelayMs),
        );
      }
    }
  }

  private persist: boolean;

  dispose() {
    if (this.ticker) clearInterval(this.ticker);
    this.timers.forEach(clearTimeout);
  }

  /** Subscribe to state changes (used to refresh queries). */
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private changed() {
    if (this.persist) storage()?.setItem(STORAGE_KEY, JSON.stringify(this.s));
    this.listeners.forEach((l) => l());
  }

  now(): number {
    return Date.now() + this.s.clockOffsetMs;
  }

  /** e2e helper: move the server clock forward (overdue checks, ask-first timeouts). */
  advance(minutes: number) {
    this.s.clockOffsetMs += minutes * MINUTE;
    this.tick();
    this.changed();
  }

  reset() {
    this.s = emptyState();
    this.changed();
  }

  /** e2e helper: a contact replies by SMS (STOP / START / REACHED). */
  inbound(fromPhone: string, body: string) {
    const word = body.trim().toUpperCase().split(/\s+/)[0];
    const contacts = this.s.contacts.filter((c) => c.phone === fromPhone);
    if (word === 'STOP') {
      for (const c of contacts) {
        if (!c.optedOut) {
          c.optedOut = true;
          this.notify('opted_out', `${c.name} opted out`, `${c.name} replied STOP, so Reached won't text them any more.`, { contact_id: c.id });
        }
      }
    } else if (word === 'START') {
      contacts.forEach((c) => (c.optedOut = false));
    } else if (word === 'REACHED') {
      for (const c of contacts) {
        if (!c.canRequestLocation || c.optedOut) continue;
        if (this.s.requests.some((r) => r.contactId === c.id && r.status === 'pending')) continue;
        const req: ContactRequest = { id: uid(), contactId: c.id, contactName: c.name, status: 'pending', createdAt: new Date(this.now()).toISOString() };
        this.s.requests.push(req);
        this.notify('contact_request', `${c.name} wants to know when you reach`, `Accept to let ${c.name} know when you arrive.`, { request_id: req.id });
      }
    }
    this.changed();
  }

  // ---------------------------------------------------------------- internals

  /** Behaves like the real backend when the browser is offline (e2e uses context.setOffline). */
  private needNetwork() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new BackendError('network', "You're offline. We'll send it when you're back online.");
    }
  }

  private me(): Profile {
    if (!this.s.userId || !this.s.profile) throw new BackendError('not_authenticated', 'Please sign in again.');
    return this.s.profile;
  }

  private name(): string {
    return this.me().firstName || 'Your contact';
  }

  private iso(ms = this.now()) {
    return new Date(ms).toISOString();
  }

  private notify(kind: string, title: string, body: string, data: Record<string, string> = {}) {
    const p = this.s.profile;
    if (p) {
      if (kind === 'arrival_sent' && !p.notifyArrivals) return;
      if (kind === 'contact_request' && !p.notifyRequests) return;
    }
    this.s.notifications.unshift({ id: uid(), kind, title, body, data, createdAt: this.iso(), readAt: null });
  }

  private addEvent(e: Partial<DemoEvent> & Pick<DemoEvent, 'kind'>): DemoEvent {
    const ev: DemoEvent = {
      id: uid(),
      status: 'sent',
      placeName: null,
      point: null,
      createdAt: this.iso(),
      feedback: null,
      tripId: null,
      placeId: null,
      autoSendAt: null,
      sosId: null,
      ...e,
    };
    this.s.events.unshift(ev);
    return ev;
  }

  private smsUsedThisMonth(): number {
    const now = new Date(this.now());
    return this.s.messages.filter((m) => {
      const d = new Date(m.createdAt);
      return m.channel === 'sms' && !m.isSafety && ['pending', 'sending', 'sent', 'delivered'].includes(m.status) && d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
    }).length;
  }

  /** Mirrors private.enqueue(). */
  private enqueue(
    ev: DemoEvent,
    template: TemplateKey,
    params: MessageParams,
    contactIds: string[],
    kind: 'arrival' | 'safety' | 'system',
    held = false,
    custom: string | null = null,
    customBy: Record<string, string> = {},
  ) {
    let used = this.smsUsedThisMonth();
    const allowance = PLANS[this.me().plan].smsPerMonth;
    const contacts = this.s.contacts.filter((c) => contactIds.includes(c.id));
    for (const c of contacts) {
      let channels: ('sms' | 'whatsapp')[] = c.channel === 'both' ? ['sms', 'whatsapp'] : [c.channel];
      let reason: string | null = null;
      if (kind === 'arrival' && used >= allowance) {
        if (c.channel === 'sms') reason = 'sms_allowance';
        else channels = ['whatsapp'];
      }
      const wording = customBy[c.id] ?? custom;
      const useCustom = wording && (template === 'arrived' || template === 'left');
      for (const ch of channels) {
        const status: MessageRow['status'] = c.optedOut ? 'opted_out' : reason ? 'failed' : held ? 'held' : 'pending';
        const m: DemoMessage = {
          id: uid(),
          eventId: ev.id,
          contactId: c.id,
          contactName: c.name,
          channel: ch,
          status,
          body: null,
          failureReason: c.optedOut ? 'Replied STOP' : reason,
          createdAt: this.iso(),
          template: useCustom ? 'custom' : template,
          params: useCustom ? { ...params, custom: wording! } : params,
          toPhone: c.phone,
          isSafety: kind === 'safety',
        };
        m.body = this.render(m, c.language);
        this.s.messages.push(m);
        if (status === 'pending') {
          if (ch === 'sms' && kind === 'arrival') used++;
          this.deliver(m);
        }
      }
    }
  }

  private render(m: Pick<DemoMessage, 'template' | 'params'>, language: Contact['language'] = 'en'): string {
    if (m.template === 'custom') return renderCustom(m.params.custom ?? '', m.params);
    return renderSms(m.template, m.params, language);
  }

  /** Simulated provider: Sending → Sent → Delivered (or Failed for …0000 numbers). */
  private deliver(m: DemoMessage) {
    const fail = m.toPhone.endsWith('0000');
    m.status = 'sending';
    this.timers.push(
      setTimeout(() => {
        if (m.status !== 'sending') return;
        if (fail) {
          m.status = 'failed';
          m.failureReason = 'Their phone was off or out of coverage';
          const c = this.s.contacts.find((x) => x.id === m.contactId);
          if (c) c.lastFailedAt = this.iso();
          this.notify('message_failed', `Message to ${m.contactName} failed`, `${m.failureReason}. Tap Retry to send it again.`, { event_id: m.eventId, message_id: m.id });
        } else {
          m.status = 'sent';
        }
        this.changed();
        if (!fail) {
          this.timers.push(
            setTimeout(() => {
              if (m.status === 'sent') {
                m.status = 'delivered';
                this.changed();
              }
            }, this.deliverDelayMs),
          );
        }
      }, this.sendDelayMs),
    );
  }

  private toldWho(ids: string[]): string {
    const names = this.s.contacts.filter((c) => ids.includes(c.id)).map((c) => c.name);
    if (names.length === 0) return 'nobody';
    if (names.length === 1) return names[0]!;
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names[0]} and ${names.length - 1} others`;
  }

  private liveTripRaw(): Trip | undefined {
    return this.s.trips.find((t) => t.status === 'active' || t.status === 'overdue' || t.status === 'alerted');
  }

  private emergencyContactIds(fallback: string[]): string[] {
    const em = this.s.contacts.filter((c) => c.isEmergency).map((c) => c.id);
    return em.length ? em : fallback;
  }

  private link(tokenValue: string) {
    return `https://reached.app/l/${tokenValue}`;
  }

  /** Server cron equivalent: overdue checks and ask-first timeouts. */
  tick() {
    if (!this.s.profile) return;
    const now = this.now();
    let dirty = false;
    for (const t of this.s.trips) {
      const action = overdueAction(
        {
          status: t.status,
          checkOnMe: t.checkOnMe,
          expectedAt: t.expectedAt ? Date.parse(t.expectedAt) : null,
          graceMinutes: t.graceMinutes,
          overduePromptedAt: t.overduePromptedAt ? Date.parse(t.overduePromptedAt) : null,
          lastCheckinAt: t.lastCheckinAt ? Date.parse(t.lastCheckinAt) : null,
        },
        now,
      );
      if (action === 'prompt') {
        t.status = 'overdue';
        t.overduePromptedAt = this.iso(now);
        this.notify('are_you_okay', 'Are you okay?', `You haven't reached ${t.destName ?? 'your destination'} yet. Tap to answer, or we'll alert your contacts in ${OVERDUE_RESPONSE_MIN} minutes.`, { trip_id: t.id });
        dirty = true;
      } else if (action === 'alert') {
        this.alertTrip(t);
        dirty = true;
      }
    }
    for (const e of this.s.events) {
      if (e.status === 'pending_confirmation' && e.autoSendAt != null && e.autoSendAt <= now) {
        this.release(e.id, true);
        dirty = true;
      }
    }
    for (const r of this.s.requests) {
      if (r.status === 'pending' && now - Date.parse(r.createdAt) >= 15 * MINUTE) {
        r.status = 'expired';
        const ev = this.addEvent({ kind: 'contact_request' });
        this.enqueue(ev, 'request_pending', { name: this.name() }, [r.contactId], 'system');
        dirty = true;
      }
    }
    if (dirty) this.changed();
  }

  private alertTrip(t: Trip) {
    t.status = 'alerted';
    const ids = this.emergencyContactIds(t.contactIds);
    const ev = this.addEvent({ kind: 'overdue_alert', tripId: t.id, placeName: t.destName, point: t.last });
    this.enqueue(
      ev,
      'overdue_alert',
      {
        name: this.name(),
        place: t.destName ?? 'their destination',
        due: t.expectedAt ? formatClock(new Date(t.expectedAt)) : '',
        lastSeen: t.lastCheckinAt ? formatClock(new Date(t.lastCheckinAt)) : 'unknown',
        link: this.link(t.liveToken),
        phoneMayBeOff: phoneMayBeOff(t.lastCheckinAt ? Date.parse(t.lastCheckinAt) : null, this.now()),
      },
      ids,
      'safety',
    );
    this.notify('alert_sent', 'Alert sent to your contacts', "We couldn't reach you, so your emergency contacts were alerted. Tap I'm safe now if you're okay.", { trip_id: t.id });
  }

  private release(eventId: string, send: boolean) {
    const ev = this.s.events.find((e) => e.id === eventId);
    if (!ev) return;
    ev.status = send ? 'sent' : 'cancelled';
    ev.autoSendAt = null;
    for (const m of this.s.messages.filter((x) => x.eventId === eventId && x.status === 'held')) {
      if (send) {
        m.status = 'pending';
        this.deliver(m);
      } else m.status = 'cancelled';
    }
  }

  private toEvent(e: DemoEvent): ActivityEvent {
    const messages = this.s.messages
      .filter((m) => m.eventId === e.id)
      .map(({ id, contactId, contactName, channel, status, body, failureReason, createdAt }) => ({ id, contactId, contactName, channel, status, body, failureReason, createdAt }));
    return { ...e, messages, previewBody: messages[0]?.body ?? null };
  }

  private completeTrip(t: Trip, at: LatLng | null, source: 'manual' | 'auto', extraContacts: string[] = [], extraCustom: string | null = null): string {
    const p = this.me();
    t.status = 'arrived';
    if (at) t.last = at;
    const held = source === 'auto' && p.arrivalMode === 'ask';
    const ids = [...new Set([...t.contactIds, ...extraContacts])];
    const ev = this.addEvent({
      kind: 'arrival',
      status: held ? 'pending_confirmation' : 'sent',
      tripId: t.id,
      placeId: t.placeId,
      placeName: t.destName,
      point: at ?? t.last,
      autoSendAt: held && p.askTimeoutMin ? this.now() + p.askTimeoutMin * MINUTE : null,
    });
    const tripMsg = (t as Trip & { message?: string | null }).message ?? null;
    const perContact = (t as Trip & { contactMessages?: Record<string, string> }).contactMessages ?? {};
    this.enqueue(
      ev,
      'arrived',
      { name: this.name(), place: t.destName ?? 'their destination', time: formatClock(new Date(this.now())) },
      ids,
      'arrival',
      held,
      tripMsg ?? extraCustom ?? p.defaultMessage,
      perContact,
    );
    if (held) this.notify('ask_first', `You've reached ${t.destName ?? 'your destination'}. Tell ${this.toldWho(ids)}?`, 'Tap Send to let them know.', { event_id: ev.id });
    else if (source === 'auto') this.notify('arrival_sent', `Told ${this.toldWho(ids)} you reached ${t.destName ?? 'your destination'}`, 'Tap to see delivery.', { event_id: ev.id });
    return ev.id;
  }

  // ---------------------------------------------------------------- auth

  async getSessionUserId() {
    return this.s.userId;
  }

  async sendOtp(phone: string) {
    const e164 = normalizeGhanaPhone(phone);
    if (!e164) throw new BackendError('bad_phone', 'Enter a Ghana mobile number, like 024 123 4567.');
    this.s.pendingPhone = e164;
    this.changed();
  }

  async verifyOtp(phone: string, code: string) {
    const e164 = normalizeGhanaPhone(phone);
    if (!e164 || code !== DEMO_OTP) throw new BackendError('bad_code', "That code isn't right.");
    const isNew = !this.s.profile || this.s.profile.phone !== e164 || !this.s.profile.onboardedAt;
    if (!this.s.profile || this.s.profile.phone !== e164) {
      const keep = this.s.clockOffsetMs;
      this.s = { ...emptyState(), clockOffsetMs: keep };
      this.s.profile = {
        id: uid(),
        firstName: null,
        phone: e164,
        email: null,
        photoUri: null,
        arrivalMode: 'auto',
        askTimeoutMin: 5,
        defaultMessage: null,
        graceMinutes: DEFAULT_GRACE_MIN,
        autoDetect: false,
        headingOutPrompts: false,
        sosHoldSeconds: 3,
        sosCountdownSeconds: 5,
        alsoAlertPolice: false,
        notifyArrivals: true,
        notifyRequests: true,
        notifyTips: false,
        retentionDays: 30,
        language: 'en',
        appearance: 'system',
        plan: 'free',
        onboardedAt: null,
      };
    }
    this.s.userId = this.s.profile.id;
    this.changed();
    return { isNew };
  }

  async startPhoneChange(phone: string) {
    if (!normalizeGhanaPhone(phone)) throw new BackendError('bad_phone', 'Enter a Ghana mobile number, like 024 123 4567.');
  }

  async confirmPhoneChange(phone: string, code: string) {
    const e164 = normalizeGhanaPhone(phone);
    if (!e164) throw new BackendError('bad_phone', 'Enter a Ghana mobile number.');
    if (code !== DEMO_OTP) throw new BackendError('bad_code', "That code isn't right.");
    this.me().phone = e164;
    this.changed();
  }

  async signOut() {
    this.s.userId = null;
    this.changed();
  }

  // ---------------------------------------------------------------- profile

  async getProfile() {
    return { ...this.me() };
  }

  async updateProfile(patch: ProfilePatch) {
    const p = this.me();
    if (patch.firstName !== undefined && patch.firstName !== null && !patch.firstName.trim()) {
      throw new BackendError('bad_name', 'Enter your first name.');
    }
    Object.assign(p, patch);
    this.changed();
    return { ...p };
  }

  // ---------------------------------------------------------------- contacts

  async listContacts() {
    this.me();
    return this.s.contacts.map((c) => ({ ...c }));
  }

  async addContact(input: ContactInput) {
    const p = this.me();
    const phone = normalizeGhanaPhone(input.phone);
    if (!phone) throw new BackendError('bad_phone', 'Enter a Ghana mobile number, like 024 123 4567.');
    if (this.s.contacts.some((c) => c.phone === phone)) throw new BackendError('duplicate', 'This person is already in your contacts.');
    if (this.s.contacts.length >= PLANS[p.plan].maxContacts) throw new BackendError('contact_limit', `Your plan allows ${PLANS[p.plan].maxContacts} people.`);
    const c: Contact = {
      id: uid(),
      name: input.name.trim(),
      phone,
      relationship: input.relationship,
      channel: input.channel,
      language: 'en',
      isDefault: input.isDefault ?? true,
      isEmergency: input.isEmergency ?? true,
      canRequestLocation: false,
      optedOut: false,
      lastFailedAt: null,
      createdAt: this.iso(),
    };
    this.s.contacts.push(c);
    const ev = this.addEvent({ kind: 'intro' });
    this.enqueue(ev, 'intro', { name: this.name() }, [c.id], 'system');
    this.changed();
    return { ...c };
  }

  async updateContact(id: string, patch: Partial<ContactInput> & { language?: Contact['language']; canRequestLocation?: boolean }) {
    const c = this.s.contacts.find((x) => x.id === id);
    if (!c) throw new BackendError('not_found', 'Contact not found.');
    if (patch.phone !== undefined) {
      const phone = normalizeGhanaPhone(patch.phone);
      if (!phone) throw new BackendError('bad_phone', 'Enter a Ghana mobile number, like 024 123 4567.');
      patch = { ...patch, phone };
    }
    Object.assign(c, patch);
    this.changed();
    return { ...c };
  }

  async removeContact(id: string) {
    this.s.contacts = this.s.contacts.filter((c) => c.id !== id);
    this.s.rules.forEach((r) => (r.contactIds = r.contactIds.filter((x) => x !== id)));
    this.changed();
  }

  async sendTestMessage(contactId: string) {
    const ev = this.addEvent({ kind: 'test' });
    this.enqueue(ev, 'test', { name: this.name() }, [contactId], 'system');
    this.changed();
    return ev.id;
  }

  // ---------------------------------------------------------------- places & rules

  async listPlaces() {
    this.me();
    return this.s.places.map((p) => ({ ...p }));
  }

  async addPlace(input: PlaceInput) {
    const p = this.me();
    const limit = Math.min(15, PLANS[p.plan].maxPlaces);
    if (this.s.places.length >= limit) throw new BackendError('place_limit', `You can save up to ${limit} places.`);
    const gps = input.ghanaPostGps ? normalizeGhanaPostGps(input.ghanaPostGps) : null;
    const place: Place = { ...input, ghanaPostGps: gps, id: uid() };
    this.s.places.push(place);
    this.changed();
    return { ...place };
  }

  async updatePlace(id: string, input: Partial<PlaceInput>) {
    const p = this.s.places.find((x) => x.id === id);
    if (!p) throw new BackendError('not_found', 'Place not found.');
    Object.assign(p, input);
    this.changed();
    return { ...p };
  }

  async removePlace(id: string) {
    this.s.places = this.s.places.filter((p) => p.id !== id);
    this.s.rules = this.s.rules.filter((r) => r.placeId !== id);
    this.changed();
  }

  async listRules() {
    this.me();
    return this.s.rules.map((r) => ({ ...r, contactIds: [...r.contactIds] }));
  }

  async saveRule(input: RuleInput) {
    if (input.id) {
      const r = this.s.rules.find((x) => x.id === input.id);
      if (!r) throw new BackendError('not_found', 'Rule not found.');
      Object.assign(r, input);
      this.changed();
      return { ...r };
    }
    const r: Rule = { ...input, id: uid() };
    this.s.rules.push(r);
    this.changed();
    return { ...r };
  }

  async deleteRule(id: string) {
    this.s.rules = this.s.rules.filter((r) => r.id !== id);
    this.changed();
  }

  /** Mirrors public.report_place_event(). */
  async reportPlaceEvent(placeId: string, event: RuleEvent, at?: LatLng | null) {
    this.needNetwork();
    const p = this.me();
    const place = this.s.places.find((x) => x.id === placeId);
    if (!place) throw new BackendError('place_not_found', 'Place not found.');
    const kind = event === 'arrive' ? 'arrival' : 'departure';
    const now = this.now();
    const last = this.s.events.find((e) => e.placeId === placeId && e.kind === kind && e.status !== 'cancelled');
    if (last && isDuplicateTrigger(Date.parse(last.createdAt), now)) return null;
    const deliveries = matchingDeliveries(this.s.rules, placeId, event, new Date(now));
    const ids = deliveries.map((d) => d.contactId);
    const custom = deliveries.find((d) => d.message)?.message ?? null;
    if (event === 'arrive') {
      const t = this.liveTripRaw();
      if (t && t.placeId === placeId && (t.status === 'active' || t.status === 'overdue')) {
        const id = this.completeTrip(t, at ?? null, 'auto', ids, custom);
        this.changed();
        return id;
      }
    }
    if (ids.length === 0) return null;
    const held = p.arrivalMode === 'ask';
    const ev = this.addEvent({
      kind,
      status: held ? 'pending_confirmation' : 'sent',
      placeId,
      placeName: place.name,
      point: at ?? null,
      autoSendAt: held && p.askTimeoutMin ? now + p.askTimeoutMin * MINUTE : null,
    });
    this.enqueue(ev, event === 'arrive' ? 'arrived' : 'left', { name: this.name(), place: place.name, time: formatClock(new Date(now)) }, ids, 'arrival', held, custom ?? (event === 'arrive' ? p.defaultMessage : null));
    const verb = event === 'arrive' ? 'reached' : 'left';
    if (held) this.notify('ask_first', `You've ${verb} ${place.name}. Tell ${this.toldWho(ids)}?`, 'Tap Send to let them know.', { event_id: ev.id });
    else this.notify('arrival_sent', `Told ${this.toldWho(ids)} you ${verb} ${place.name}`, 'Tap to see delivery.', { event_id: ev.id });
    this.changed();
    return ev.id;
  }

  async reportAutoArrival(area: string, at: LatLng) {
    const p = this.me();
    if (!p.autoDetect) throw new BackendError('auto_detect_off', 'Turn on auto-detect first.');
    const recent = this.s.events.find((e) => e.kind === 'arrival' && e.placeName === area && this.now() - Date.parse(e.createdAt) < 60 * MINUTE);
    if (recent) return null;
    const ids = this.s.contacts.filter((c) => c.isDefault).map((c) => c.id);
    if (!ids.length) return null;
    const held = p.arrivalMode === 'ask';
    const ev = this.addEvent({ kind: 'arrival', status: held ? 'pending_confirmation' : 'sent', placeName: area, point: at, autoSendAt: held && p.askTimeoutMin ? this.now() + p.askTimeoutMin * MINUTE : null });
    this.enqueue(ev, 'arrived', { name: this.name(), place: area, time: formatClock(new Date(this.now())) }, ids, 'arrival', held, p.defaultMessage);
    this.changed();
    return ev.id;
  }

  // ---------------------------------------------------------------- trips

  async getLiveTrip() {
    this.me();
    const t = this.liveTripRaw();
    return t ? { ...t } : null;
  }

  async startTrip(input: StartTripInput) {
    this.me();
    const ids = input.contactIds.filter((id) => this.s.contacts.some((c) => c.id === id));
    if (!ids.length) throw new BackendError('no_contacts', 'Choose at least one person to tell.');
    if (input.checkOnMe && (!input.expectedAt || Date.parse(input.expectedAt) <= this.now())) {
      throw new BackendError('bad_expected_time', 'Choose a time in the future.');
    }
    if (this.liveTripRaw()) throw new BackendError('trip_in_progress', 'Finish or cancel your current trip first.');
    const place = input.placeId ? this.s.places.find((x) => x.id === input.placeId) : undefined;
    const t: Trip & { message?: string | null; contactMessages?: Record<string, string> } = {
      id: uid(),
      placeId: place?.id ?? null,
      destName: place?.name ?? input.destName ?? null,
      dest: place ? { lat: place.lat, lng: place.lng } : (input.dest ?? null),
      radius: place?.radius ?? input.radius ?? 150,
      status: 'active',
      startedAt: this.iso(),
      expectedAt: input.expectedAt,
      graceMinutes: input.graceMinutes,
      checkOnMe: input.checkOnMe,
      overduePromptedAt: null,
      contactIds: ids,
      liveToken: token(),
      lastCheckinAt: this.iso(),
      last: input.here ?? null,
      transportType: input.transportType ?? null,
      plate: input.plate ?? null,
      platePhotoUri: input.platePhotoUri ?? null,
      driverName: input.driverName ?? null,
      car: input.car ?? null,
      rideProvider: input.rideProvider ?? null,
      rideLink: input.rideLink ?? null,
      message: input.message ?? null,
      contactMessages: input.contactMessages ?? {},
    };
    this.s.trips.unshift(t);
    if (input.tellLeaving) {
      const ev = this.addEvent({ kind: 'on_the_way', tripId: t.id, placeId: t.placeId, placeName: t.destName });
      this.enqueue(ev, 'on_the_way', { name: this.name(), place: t.destName ?? 'their destination', due: t.expectedAt ? formatClock(new Date(t.expectedAt)) : 'soon' }, ids, 'arrival');
    }
    this.changed();
    return { ...t };
  }

  private live(tripId: string): Trip {
    const t = this.s.trips.find((x) => x.id === tripId);
    if (!t) throw new BackendError('trip_not_found', 'Trip not found.');
    if (!['active', 'overdue', 'alerted'].includes(t.status)) throw new BackendError('trip_not_live', 'This trip has already ended.');
    return t;
  }

  async arriveTrip(tripId: string, at?: LatLng | null, source: 'manual' | 'auto' = 'manual') {
    this.needNetwork();
    const id = this.completeTrip(this.live(tripId), at ?? null, source);
    this.changed();
    return id;
  }

  async extendTrip(tripId: string, minutes: number, tell: boolean) {
    const t = this.live(tripId);
    if (t.status === 'alerted') throw new BackendError('trip_alerted', "Your contacts were alerted. Tap I'm safe now first.");
    t.expectedAt = this.iso(extendExpected(t.expectedAt ? Date.parse(t.expectedAt) : null, minutes, this.now()));
    t.checkOnMe = true;
    t.status = 'active';
    t.overduePromptedAt = null;
    if (tell) {
      const ev = this.addEvent({ kind: 'running_late', tripId: t.id, placeName: t.destName });
      this.enqueue(ev, 'running_late', { name: this.name(), place: t.destName ?? '', due: formatClock(new Date(t.expectedAt)) }, t.contactIds, 'arrival');
    }
    this.changed();
    return { ...t };
  }

  async cancelTrip(tripId: string, tell: boolean) {
    const t = this.live(tripId);
    if (t.status === 'alerted') throw new BackendError('trip_alerted', "Your contacts were alerted. Tap I'm safe now instead.");
    t.status = 'cancelled';
    if (tell) {
      const ev = this.addEvent({ kind: 'plans_changed', tripId: t.id, placeName: t.destName });
      this.enqueue(ev, 'plans_changed', { name: this.name(), place: t.destName ?? 'their destination' }, t.contactIds, 'arrival');
    }
    this.changed();
  }

  async checkin(tripId: string, at: LatLng): Promise<TripStatus> {
    const t = this.live(tripId);
    t.last = at;
    t.lastCheckinAt = this.iso();
    this.changed();
    return t.status;
  }

  async respondOverdue(tripId: string, answer: OverdueAnswer, minutes?: number) {
    const t = this.live(tripId);
    switch (answer) {
      case 'arrived':
        return { eventId: await this.arriveTrip(tripId, null, 'manual') };
      case 'still_going':
        await this.extendTrip(tripId, 15, false);
        return {};
      case 'more_time':
        if (![15, 30, 60].includes(minutes ?? 0)) throw new BackendError('bad_minutes', 'Pick 15, 30 or 60 minutes.');
        await this.extendTrip(tripId, minutes!, false);
        return {};
      case 'get_help': {
        const sos = await this.triggerSos(t.last, null, 'overdue_help');
        return { sosId: sos.id };
      }
    }
  }

  // ---------------------------------------------------------------- activity

  async listEvents() {
    this.me();
    return this.s.events.map((e) => this.toEvent(e));
  }

  async getEvent(id: string) {
    const e = this.s.events.find((x) => x.id === id);
    return e ? this.toEvent(e) : null;
  }

  async resendMessage(messageId: string) {
    const m = this.s.messages.find((x) => x.id === messageId);
    if (!m || m.status !== 'failed' || m.failureReason === 'sms_allowance') throw new BackendError('cannot_resend', "This message can't be resent.");
    m.status = 'pending';
    m.failureReason = null;
    // A retry to a number that keeps failing still fails; others go through.
    this.deliver(m);
    this.changed();
  }

  async eventFeedback(eventId: string, feedback: FeedbackKey) {
    const e = this.s.events.find((x) => x.id === eventId);
    if (e) e.feedback = feedback;
    this.changed();
  }

  async confirmEvent(eventId: string, send: boolean) {
    const e = this.s.events.find((x) => x.id === eventId);
    if (!e || e.status !== 'pending_confirmation') throw new BackendError('event_not_pending', 'Already handled.');
    this.release(eventId, send);
    this.changed();
  }

  async sendReachedNow(contactIds: string[], area: string, at?: LatLng | null) {
    if (!contactIds.length) throw new BackendError('no_contacts', 'Choose at least one person to tell.');
    const place = area.trim() || 'their destination';
    const ev = this.addEvent({ kind: 'arrival', placeName: place, point: at ?? null });
    this.enqueue(ev, 'arrived', { name: this.name(), place, time: formatClock(new Date(this.now())) }, contactIds, 'arrival', false, this.me().defaultMessage);
    this.changed();
    return ev.id;
  }

  async runSelfTest() {
    const p = this.me();
    const ev = this.addEvent({ kind: 'test', placeName: 'Test place' });
    const m: DemoMessage = {
      id: uid(),
      eventId: ev.id,
      contactId: null,
      contactName: 'You',
      channel: 'sms',
      status: 'pending',
      body: null,
      failureReason: null,
      createdAt: this.iso(),
      template: 'arrived',
      params: { name: p.firstName ?? 'You', place: 'Test place', time: formatClock(new Date(this.now())) },
      toPhone: p.phone,
      isSafety: false,
    };
    m.body = this.render(m);
    this.s.messages.push(m);
    this.deliver(m);
    this.changed();
    return ev.id;
  }

  // ---------------------------------------------------------------- safety

  async getOpenSos() {
    this.me();
    const s = this.s.sos.find((x) => x.status === 'sent');
    return s ? { id: s.id, status: s.status, sentAt: s.sentAt, liveToken: s.liveToken } : null;
  }

  async triggerSos(at: LatLng | null, _battery: number | null, _trigger = 'shield') {
    this.me();
    const open = this.s.sos.find((x) => x.status === 'sent');
    if (open) return { id: open.id, status: open.status, sentAt: open.sentAt, liveToken: open.liveToken };
    const trip = this.liveTripRaw();
    const sos = { id: uid(), status: 'sent' as const, sentAt: this.iso(), liveToken: token(), tripId: trip?.id ?? null };
    this.s.sos.push(sos);
    if (trip) trip.status = 'alerted';
    const ids = this.emergencyContactIds(this.s.contacts.map((c) => c.id));
    const ev = this.addEvent({ kind: 'sos', sosId: sos.id, tripId: trip?.id ?? null, placeName: trip?.destName ?? null, point: at ?? trip?.last ?? null });
    this.enqueue(ev, 'sos', { name: this.name(), time: formatClock(new Date(this.now())), link: this.link(sos.liveToken), emergencyNumber: '112' }, ids, 'safety');
    this.changed();
    return { id: sos.id, status: sos.status, sentAt: sos.sentAt, liveToken: sos.liveToken };
  }

  async sosPing(sosId: string, at: LatLng) {
    const s = this.s.sos.find((x) => x.id === sosId && x.status === 'sent');
    if (!s) throw new BackendError('sos_not_open', 'This alert has ended.');
    const t = s.tripId ? this.s.trips.find((x) => x.id === s.tripId) : null;
    if (t) t.last = at;
  }

  async imSafe() {
    const openSos = this.s.sos.filter((x) => x.status === 'sent');
    const alerted = this.s.trips.filter((t) => t.status === 'alerted');
    if (!openSos.length && !alerted.length) throw new BackendError('nothing_to_clear', 'There is no alert to clear.');
    const alertedEvents = this.s.events.filter(
      (e) => (e.kind === 'sos' || e.kind === 'overdue_alert') && ((e.sosId && openSos.some((s) => s.id === e.sosId)) || (e.tripId && alerted.some((t) => t.id === e.tripId))),
    );
    const ids = [...new Set(this.s.messages.filter((m) => alertedEvents.some((e) => e.id === m.eventId) && m.contactId).map((m) => m.contactId!))];
    openSos.forEach((s) => (s.status = 'cleared'));
    alerted.forEach((t) => (t.status = 'cancelled'));
    const ev = this.addEvent({ kind: 'all_clear' });
    this.enqueue(ev, 'all_clear', { name: this.name(), time: formatClock(new Date(this.now())) }, ids, 'safety');
    this.changed();
    return ev.id;
  }

  // ---------------------------------------------------------------- notifications & requests

  async listNotifications() {
    return this.s.notifications.map((n) => ({ ...n }));
  }

  async markNotificationRead(id: string) {
    const n = this.s.notifications.find((x) => x.id === id);
    if (n) n.readAt = this.iso();
    this.changed();
  }

  async registerPushToken() {}

  async listRequests() {
    return this.s.requests.map((r) => ({ ...r }));
  }

  async respondRequest(id: string, accept: boolean, trip?: Partial<StartTripInput> | null) {
    const r = this.s.requests.find((x) => x.id === id);
    if (!r || (r.status !== 'pending' && r.status !== 'expired')) throw new BackendError('request_not_pending', 'Already answered.');
    const ev = this.addEvent({ kind: 'contact_request' });
    this.enqueue(ev, accept ? 'request_accept' : 'request_decline', { name: this.name() }, [r.contactId], 'system');
    r.status = accept ? 'accepted' : 'declined';
    if (accept && trip) {
      await this.startTrip({
        contactIds: [r.contactId],
        tellLeaving: false,
        checkOnMe: false,
        expectedAt: null,
        graceMinutes: this.me().graceMinutes,
        ...trip,
        source: 'request',
      } as StartTripInput);
    }
    this.changed();
  }

  // ---------------------------------------------------------------- privacy

  async deleteActivity() {
    this.s.events = [];
    this.s.messages = [];
    this.s.notifications = [];
    this.s.trips = this.s.trips.filter((t) => ['active', 'overdue', 'alerted'].includes(t.status));
    this.changed();
  }

  async exportData() {
    const p = this.me();
    return {
      exported_at: this.iso(),
      profile: p,
      contacts: this.s.contacts,
      places: this.s.places,
      rules: this.s.rules,
      trips: this.s.trips.map(({ liveToken: _l, ...t }) => t),
      events: this.s.events,
      messages: this.s.messages.map(({ toPhone: _p, ...m }) => m),
    };
  }

  async deleteAccount(code: string) {
    if (code !== DEMO_OTP) throw new BackendError('bad_code', "That code isn't right.");
    const keep = this.s.clockOffsetMs;
    this.s = { ...emptyState(), clockOffsetMs: keep };
    this.changed();
  }

  // ---------------------------------------------------------------- phase 2/3

  async lookupGhanaPost(code: string) {
    const gps = normalizeGhanaPostGps(code);
    if (!gps) return null;
    const digits = gps.replace(/\D/g, '');
    const a = Number(digits.slice(0, 3)) / 1000;
    const b = Number(digits.slice(-4)) / 10000;
    return { lat: ACCRA.lat + (a - 0.5) * 0.08, lng: ACCRA.lng + (b - 0.5) * 0.08, address: `${gps}, Greater Accra` };
  }

  async nearestPolice(at: LatLng) {
    return nearestStations(at, POLICE, 5).map((s) => ({ ...s }));
  }

  async startSubscription(plan: Exclude<PlanId, 'free'>, method: PaymentMethod, payPhone: string | null) {
    if (method !== 'card' && !(payPhone && normalizeGhanaPhone(payPhone))) {
      throw new BackendError('bad_pay_phone', 'Enter the mobile money number to charge.');
    }
    const sub: Subscription = { id: uid(), plan, status: 'pending', providerRef: `rch_${token()}`, amountGhs: PLANS[plan].priceGhsMonthly, currentPeriodEnd: null };
    this.s.subscriptions.push(sub);
    this.changed();
    return { ...sub };
  }

  async confirmPayment(providerRef: string) {
    const sub = this.s.subscriptions.find((x) => x.providerRef === providerRef);
    if (!sub) throw new BackendError('not_found', 'Payment not found.');
    if (sub.status === 'pending') {
      sub.status = 'active';
      sub.currentPeriodEnd = this.iso(this.now() + 30 * 24 * 60 * MINUTE);
      this.me().plan = sub.plan;
    }
    this.changed();
    return { ...sub };
  }

  async reportProblem() {}

  /** The demo's fake_messages: every text that "went out", newest last. */
  debugMessages() {
    return this.s.messages
      .filter((m) => m.status !== 'held' && m.status !== 'cancelled')
      .map((m) => ({ toPhone: m.toPhone, contactName: m.contactName, channel: m.channel, template: m.template, status: m.status, body: m.body }));
  }

  /** Exposed for unit tests. */
  get debug() {
    return { state: this.s, dueAt };
  }
}
