'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatClock, formatGhanaPhone, relativeAgo, telLink } from '@reached/core';
import { Icon } from '@/components/Icon';
import { LiveMap, mapsLink } from '@/components/LiveMap';
import { StaffGate } from '@/components/StaffGate';
import type { Backend } from '@/lib/backend';
import { NotAllowedError } from '@/lib/errors';
import type { PoliceAlert } from '@/lib/types';

const REFRESH_MS = 15_000;

function safeHttpUrl(u: string | null): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function AlertCard({ a, now }: { a: PoliceAlert; now: Date }) {
  const live = a.status === 'sent';
  const name = a.first_name ?? 'Unknown';
  const ride = safeHttpUrl(a.ride_link);
  return (
    <article className={`card alert-card ${live ? '' : 'cleared'}`} data-testid="police-alert" data-status={a.status} aria-labelledby={`a-${a.sos_id}`}>
      <div className="toolbar" style={{ marginBottom: 8 }}>
        <h3 id={`a-${a.sos_id}`} style={{ margin: 0 }}>
          {name}
        </h3>
        {live ? (
          <span className="chip solid-red">LIVE SOS</span>
        ) : (
          <span className="chip amber" data-testid="cancelled-badge">
            CANCELLED{a.cleared_at ? ` at ${formatClock(new Date(a.cleared_at))}` : ''}
          </span>
        )}
      </div>
      {!live && (
        <p className="small">
          <strong>{name} cancelled this alert</strong> (marked safe or false alarm). No response needed unless you are
          already in contact.
        </p>
      )}
      <dl className="kv">
        <dt>SOS sent</dt>
        <dd>
          {formatClock(new Date(a.sent_at))} ({relativeAgo(new Date(a.sent_at), now)})
        </dd>
        <dt>Location</dt>
        <dd>
          {a.lat != null && a.lng != null ? (
            <>
              {a.lat.toFixed(5)}, {a.lng.toFixed(5)}
              {a.last_ping_at ? <span className="muted"> · updated {relativeAgo(new Date(a.last_ping_at), now)}</span> : null}{' '}
              <a href={mapsLink(a.lat, a.lng)} target="_blank" rel="noopener noreferrer">
                Open in maps
              </a>
            </>
          ) : (
            'Not received yet'
          )}
        </dd>
        {a.battery_pct != null && (
          <>
            <dt>Battery</dt>
            <dd>{a.battery_pct}%</dd>
          </>
        )}
        {a.phone && (
          <>
            <dt>Phone</dt>
            <dd>
              <a href={telLink(a.phone)}>{formatGhanaPhone(a.phone)}</a>
            </dd>
          </>
        )}
        {a.destination && (
          <>
            <dt>Heading to</dt>
            <dd>{a.destination}</dd>
          </>
        )}
        {a.transport_type && (
          <>
            <dt>Transport</dt>
            <dd>{a.transport_type}</dd>
          </>
        )}
        {a.plate && (
          <>
            <dt>Plate</dt>
            <dd>
              <span className="plate" data-testid="plate">
                {a.plate}
              </span>
            </dd>
          </>
        )}
        {a.car && (
          <>
            <dt>Car</dt>
            <dd>{a.car}</dd>
          </>
        )}
        {a.driver_name && (
          <>
            <dt>Driver</dt>
            <dd>{a.driver_name}</dd>
          </>
        )}
        {ride && (
          <>
            <dt>Ride link</dt>
            <dd>
              <a href={ride} target="_blank" rel="noopener noreferrer">
                Open ride link
              </a>
            </dd>
          </>
        )}
        {a.plate_photo_path && (
          <>
            <dt>Plate photo</dt>
            <dd>On file. Request it from Reached support with alert ID {a.sos_id.slice(0, 8)}.</dd>
          </>
        )}
      </dl>
    </article>
  );
}

function Feed({ backend }: { backend: Backend }) {
  const [alerts, setAlerts] = useState<PoliceAlert[] | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      setAlerts(await backend.policeFeed());
      setError(false);
      setFetchedAt(Date.now());
    } catch (e) {
      if (e instanceof NotAllowedError) setBlocked(true);
      else setError(true);
    }
    setNow(Date.now());
  }, [backend]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), 5_000);
    return () => {
      clearInterval(t);
      clearInterval(tick);
    };
  }, [load]);

  if (blocked) {
    return (
      <div className="card warning" data-testid="not-approved">
        <h2>Your account isn&apos;t approved yet</h2>
        <p>
          Only officers approved through the Ghana Police Service partnership can see SOS alerts. If you have applied,
          approval usually takes 1 to 2 working days. Contact your station commander or Reached support.
        </p>
      </div>
    );
  }

  if (!alerts) {
    return error ? (
      <div className="card" role="alert">
        <p>Couldn&apos;t load alerts. Check your connection.</p>
        <button type="button" className="btn" onClick={() => void load()}>
          Try again
        </button>
      </div>
    ) : (
      <div className="skeleton" style={{ height: 300 }} role="status" aria-label="Loading alerts" />
    );
  }

  const live = alerts.filter((a) => a.status === 'sent');
  const cleared = alerts.filter((a) => a.status !== 'sent');
  const nowDate = new Date(now);
  const points = alerts
    .filter((a) => a.lat != null && a.lng != null)
    .map((a) => ({ id: a.sos_id, lat: a.lat!, lng: a.lng!, label: `${a.first_name ?? 'Alert'}${a.status === 'sent' ? ' (live SOS)' : ' (cancelled)'}`, tone: a.status === 'sent' ? ('danger' as const) : ('muted' as const) }));

  return (
    <div>
      <div className="toolbar">
        <div className="chips">
          <span className="chip solid-red" data-testid="live-count">
            {live.length} live SOS
          </span>
          <span className="chip amber">{cleared.length} cancelled (last 2 hours)</span>
        </div>
        <span className="small muted" role="status">
          {error ? 'Refresh failed, retrying · ' : ''}Updated {fetchedAt ? relativeAgo(new Date(fetchedAt), nowDate) : '—'} · refreshes every 15 s
        </span>
      </div>
      <div className="map-card">
        <LiveMap points={points} label="Map of SOS alerts" height={360} />
      </div>
      {alerts.length === 0 ? (
        <div className="card soft">
          <h2>No SOS alerts right now</h2>
          <p className="muted">New alerts appear here automatically.</p>
        </div>
      ) : (
        <>
          {live.map((a) => (
            <AlertCard key={a.sos_id} a={a} now={nowDate} />
          ))}
          {cleared.length > 0 && <h2 style={{ marginTop: 24 }}>Cancelled alerts</h2>}
          {cleared.map((a) => (
            <AlertCard key={a.sos_id} a={a} now={nowDate} />
          ))}
        </>
      )}
    </div>
  );
}

export function PoliceDashboard() {
  return (
    <StaffGate
      title="Police alert dashboard"
      intro="For approved Ghana Police Service officers. Sign in with the phone number registered for your account."
      demoHint="Officer: 020 000 0001. Not approved: any other number. Code 123456."
    >
      {({ backend }) => (
        <>
          <h1>
            <Icon name="shield" size={26} /> Live SOS alerts
          </h1>
          <p className="muted">
            Only from Reached users who switched on “Also alert the police”. Cancelled alerts stay for 2 hours.
          </p>
          <Feed backend={backend} />
        </>
      )}
    </StaffGate>
  );
}
