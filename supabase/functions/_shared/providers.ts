import type { DbClient, Env } from './db.ts';

/**
 * Message providers. MESSAGING_MODE must be exactly "live" for a real SMS or
 * WhatsApp message to leave the building; anything else (including unset)
 * routes everything to FakeProvider, which only writes public.fake_messages.
 */

export type Channel = 'sms' | 'whatsapp';

export interface OutboundMessage {
  /** E.164, e.g. +233241234567 */
  to: string;
  body: string;
  channel: Channel;
}

export type SendResult = { ok: true; providerId: string } | { ok: false; reason: string };

export interface MessageProvider {
  readonly name: string;
  send(msg: OutboundMessage): Promise<SendResult>;
}

export type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/** Writes every message to public.fake_messages. The default everywhere. */
export class FakeProvider implements MessageProvider {
  readonly name = 'fake';
  constructor(private db: DbClient, private newId: () => string = () => crypto.randomUUID()) {}

  async send(msg: OutboundMessage): Promise<SendResult> {
    const providerId = `fake_${this.newId()}`;
    const { error } = await this.db.from('fake_messages').insert({
      to_phone: msg.to,
      channel: msg.channel,
      body: msg.body,
      provider_message_id: providerId,
    });
    if (error) return { ok: false, reason: `fake provider: ${error.message}` };
    return { ok: true, providerId };
  }
}

export interface AfricasTalkingConfig {
  username: string;
  apiKey: string;
  senderId?: string;
  sandbox?: boolean;
}

export const AT_LIVE_URL = 'https://api.africastalking.com/version1/messaging';
export const AT_SANDBOX_URL = 'https://api.sandbox.africastalking.com/version1/messaging';

interface AtRecipient {
  status?: string;
  statusCode?: number;
  messageId?: string;
  number?: string;
}

/** Africa's Talking bulk SMS API (one recipient per call). */
export class AfricasTalkingSms implements MessageProvider {
  readonly name = 'africastalking';
  constructor(private config: AfricasTalkingConfig, private fetchFn: FetchFn = fetch) {}

  get url(): string {
    return this.config.sandbox ? AT_SANDBOX_URL : AT_LIVE_URL;
  }

  async send(msg: OutboundMessage): Promise<SendResult> {
    const form = new URLSearchParams({ username: this.config.username, to: msg.to, message: msg.body });
    if (this.config.senderId) form.set('from', this.config.senderId);
    let res: Response;
    try {
      res = await this.fetchFn(this.url, {
        method: 'POST',
        headers: {
          apiKey: this.config.apiKey,
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      });
    } catch (e) {
      return { ok: false, reason: `Network error: ${(e as Error).message}` };
    }
    const raw = await res.text();
    if (!res.ok) return { ok: false, reason: `Africa's Talking HTTP ${res.status}: ${raw.slice(0, 200)}` };
    let parsed: { SMSMessageData?: { Message?: string; Recipients?: AtRecipient[] } };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, reason: `Africa's Talking returned an unreadable response` };
    }
    const r = parsed.SMSMessageData?.Recipients?.[0];
    if (!r) return { ok: false, reason: parsed.SMSMessageData?.Message || 'No recipient in response' };
    if (r.status === 'Success' && r.messageId) return { ok: true, providerId: r.messageId };
    return { ok: false, reason: r.status || 'Unknown error' };
  }
}

export interface WhatsAppConfig {
  accessToken?: string;
  phoneNumberId?: string;
}

export const WHATSAPP_GRAPH_URL = 'https://graph.facebook.com/v21.0';

/**
 * WhatsApp Cloud API. Phase 1 stub: unless both the access token and phone
 * number id are configured it refuses to send. Free-form text only reaches a
 * contact inside the 24 h customer-service window; approved templates are a
 * later phase.
 */
export class WhatsAppCloud implements MessageProvider {
  readonly name = 'whatsapp';
  constructor(private config: WhatsAppConfig, private fetchFn: FetchFn = fetch) {}

  get configured(): boolean {
    return Boolean(this.config.accessToken && this.config.phoneNumberId);
  }

  async send(msg: OutboundMessage): Promise<SendResult> {
    if (!this.configured) return { ok: false, reason: 'WhatsApp not configured' };
    const url = `${WHATSAPP_GRAPH_URL}/${this.config.phoneNumberId}/messages`;
    let res: Response;
    try {
      res = await this.fetchFn(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.config.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: msg.to.replace(/^\+/, ''),
          type: 'text',
          text: { preview_url: false, body: msg.body },
        }),
      });
    } catch (e) {
      return { ok: false, reason: `Network error: ${(e as Error).message}` };
    }
    let parsed: { messages?: { id?: string }[]; error?: { message?: string } } = {};
    try {
      parsed = await res.json();
    } catch {
      // fall through
    }
    const id = parsed.messages?.[0]?.id;
    if (res.ok && id) return { ok: true, providerId: id };
    return { ok: false, reason: parsed.error?.message || `WhatsApp HTTP ${res.status}` };
  }
}

export function isLive(env: Env): boolean {
  return env.MESSAGING_MODE === 'live';
}

/** Pick the provider for a channel. Real providers only when MESSAGING_MODE === 'live'. */
export function getProvider(channel: Channel, env: Env, db: DbClient, fetchFn: FetchFn = fetch): MessageProvider {
  if (!isLive(env)) return new FakeProvider(db);
  if (channel === 'whatsapp') {
    return new WhatsAppCloud(
      { accessToken: env.WHATSAPP_ACCESS_TOKEN, phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID },
      fetchFn,
    );
  }
  return new AfricasTalkingSms(
    {
      username: env.AFRICASTALKING_USERNAME || 'sandbox',
      apiKey: env.AFRICASTALKING_API_KEY ?? '',
      senderId: env.AFRICASTALKING_SENDER_ID || undefined,
      sandbox: env.AFRICASTALKING_SANDBOX === 'true',
    },
    fetchFn,
  );
}
