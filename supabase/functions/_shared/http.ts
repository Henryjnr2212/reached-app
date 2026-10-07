/** Small HTTP helpers shared by every Edge Function. */

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...headers },
  });
}

export function text(body: string, status = 200): Response {
  return new Response(body, { status, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
}

/** `{ error: { code, message } }` with a plain-language message. */
export function error(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status);
}

/** Answer CORS preflight; returns null for every other method. */
export function preflight(req: Request): Response | null {
  return req.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders }) : null;
}

export function bearerToken(req: Request): string | null {
  const h = req.headers.get('authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m?.[1]?.trim() || null;
}

/** Parse a JSON body into a plain object; null when it isn't one. */
export async function readJsonObject(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

/** Parse an application/x-www-form-urlencoded (or multipart) body to a flat record. */
export async function readForm(req: Request): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const type = req.headers.get('content-type') ?? '';
  if (type.includes('multipart/form-data')) {
    const fd = await req.formData();
    for (const [k, v] of fd.entries()) if (typeof v === 'string') out[k] = v;
    return out;
  }
  const raw = await req.text();
  for (const [k, v] of new URLSearchParams(raw)) out[k] = v;
  return out;
}

/** Last path segment, e.g. "/functions/v1/payments/webhook" → "webhook". */
export function lastPathSegment(req: Request): string {
  const parts = new URL(req.url).pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}
