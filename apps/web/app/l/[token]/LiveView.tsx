'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { formatClock, formatGhanaPhone, GHANA_EMERGENCY_NUMBERS, relativeAgo, telLink } from '@reached/core';
import { Icon } from '@/components/Icon';
import { LiveMap, mapsLink } from '@/components/LiveMap';
import { getBackend } from '@/lib/backend';
import type { LiveDetails, LiveOk, LiveResult } from '@/lib/types';

const REFRESH_MS = 30_000;

const TRANSPORT: Record<string, string> = {
  ride: 'Ride-hailing',
  taxi: 'Taxi',
  trotro: 'Trotro',
  bus: 'Bus',
  car: 'Own car',
  okada: 'Okada',
  walk: 'Walking',
  other: 'Other',
};

function safeHttpUrl(u: string | null): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

interface Status {
  tone: 'trip' | 'emergency' | 'cleared';
  title: string;
  sub: string | null;
}

export function liveStatus(d: LiveOk): Status {
  const name = d.name ?? 'Your contact';
  const dest = d.destination;
  const due = d.expected_at ? formatClock(new Date(d.expected_at)) : null;
  if (d.cleared) {
    return { tone: 'cleared', title: `Cleared — ${name} is safe`, sub: `${name} confirmed they are okay. This page will stop updating soon.` };
  }
  if (d.emergency) {
    return {
      tone: 'emergency',
      title: 'EMERGENCY',
      sub:
        d.kind === 'sos'
          ? `${name} sent an SOS. Call ${name} now. If you can't reach ${name}, call 112.`
          : `${name} hasn't arrived${dest ? ` at ${dest}` : ''}${due ? ` (due ${due})` : ''} and isn't responding. Call ${name} now. If you can't reach ${name}, call 112.`,
    };
  }
  switch (d.trip_status) {
    case 'active':
      return { tone: 'trip', title: dest ? `On the way to ${dest}` : 'On the way', sub: due ? `expected around ${due}` : null };
    case 'overdue':
      return { tone: 'trip', title: dest ? `Running late to ${dest}` : 'Running late', sub: due ? `was expected around ${due}` : null };
    case 'arrived':
      return { tone: 'trip', title: dest ? `Arrived at ${dest}` : 'Arrived', sub: null };
    default:
      return { tone: 'trip', title: `${name} is sharing their location`, sub: null };
  }
}

function Details({ d, name }: { d: LiveDetails; name: string }) {
  const ride = safeHttpUrl(d.ride_link);
  const rows: [string, ReactNode][] = [];
  if (d.transport) rows.push(['Transport', TRANSPORT[d.transport] ?? d.transport]);
  if (d.ride_provider) rows.push(['Ride app', d.ride_provider]);
  if (d.car) rows.push(['Car', d.car]);
  if (d.plate) rows.push(['Number plate', <span className="plate" key="p">{d.plate}</span>]);
  if (d.driver) rows.push(['Driver', d.driver]);
  if (ride)
    rows.push([
      'Ride link',
      <a key="r" href={ride} target="_blank" rel="noopener noreferrer">
        Open the ride link
      </a>,
    ]);
  if (d.has_plate_photo) rows.push(['Plate photo', `Saved in ${name}'s app`]);
  return (
    <section className="card" aria-labelledby="details-title" data-testid="trip-details">
      <h2 id="details-title">Trip details</h2>
      {rows.length ? (
        <dl className="kv">
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: 'contents' }}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="muted">No trip details were added.</p>
      )}
    </section>
  );
}

function GetReached() {
  return (
    <aside className="card soft" aria-label="About Reached">
      <p style={{ marginBottom: 8 }}>
        <strong>Reached</strong> lets people tell their family they arrived safely, with a simple text.
      </p>
      <Link href="/" className="btn ghost">
        Get Reached for yourself <Icon name="arrow" size={18} />
      </Link>
    </aside>
  );
}

export function LiveView({ token }: { token: string }) {
  const [backend] = useState(getBackend);
  const [data, setData] = useState<LiveResult | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (!backend) return;
    try {
      const res = await backend.getLive(token);
      setData(res);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
    setNow(Date.now());
  }, [backend, token]);

  useEffect(() => {
    void load();
    const refresh = setInterval(() => void load(), REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(refresh);
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  if (!backend) {
    return (
      <div className="container live-wrap">
        <div className="card">
          <h1>Live location isn&apos;t available</h1>
          <p className="muted">This page can&apos;t load right now. Call the person who shared it with you.</p>
        </div>
        <GetReached />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container live-wrap" aria-busy={!loadError}>
        {loadError ? (
          <div className="card" role="alert">
            <h1>We couldn&apos;t load this page</h1>
            <p className="muted">Check your internet connection and try again.</p>
            <button type="button" className="btn" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : (
          <>
            <p className="visually-hidden" role="status">
              Loading live location…
            </p>
            <div className="skeleton" style={{ height: 88, marginBottom: 16 }} />
            <div className="skeleton" style={{ height: 300, marginBottom: 16 }} />
            <div className="skeleton" style={{ height: 60 }} />
          </>
        )}
      </div>
    );
  }

  if (data.state === 'not_found') {
    return (
      <div className="container live-wrap" data-state="not_found">
        <div className="card">
          <span className="icon-square amber" style={{ marginBottom: 12 }}>
            <Icon name="alert" />
          </span>
          <h1>This link isn&apos;t working</h1>
          <p className="muted">
            Check that you opened the full link from the text message. Live links are long and easy to cut short.
          </p>
        </div>
        <GetReached />
      </div>
    );
  }

  if (data.state === 'ended') {
    const name = data.name ?? 'Your contact';
    return (
      <div className="container live-wrap" data-state="ended">
        <div className="card">
          <span className="icon-square" style={{ marginBottom: 12 }}>
            <Icon name="check" />
          </span>
          <h1>This trip has ended</h1>
          <p className="muted">
            {name}&apos;s live location is no longer shared. Links stop working when the trip ends, to keep {name}&apos;s
            location private.
          </p>
        </div>
        <GetReached />
      </div>
    );
  }

  const d = data;
  const name = d.name ?? 'Your contact';
  const status = liveStatus(d);
  const emergency = d.emergency && !d.cleared;
  const hasLocation = d.lat != null && d.lng != null;
  const updated = d.updated_at ? relativeAgo(new Date(d.updated_at), new Date(now)) : null;
  const lowBattery = d.battery_pct != null && d.battery_pct <= 20;

  return (
    <div className="container live-wrap" data-state={emergency ? 'emergency' : d.cleared ? 'cleared' : 'live'}>
      <div className={`status-banner ${status.tone}`} role={emergency ? 'alert' : undefined}>
        <span className={`icon-square ${status.tone === 'emergency' ? 'red' : status.tone === 'trip' ? 'blue' : ''}`}>
          <Icon name={status.tone === 'emergency' ? 'alert' : status.tone === 'cleared' ? 'check' : 'pin'} />
        </span>
        <div>
          <h1 data-testid="live-status">
            {status.title}
            {status.sub && status.tone === 'trip' ? <span style={{ fontWeight: 600 }}> · {status.sub}</span> : null}
          </h1>
          {status.sub && status.tone !== 'trip' ? <p>{status.sub}</p> : null}
        </div>
      </div>

      <div className="map-card">
        {hasLocation ? (
          <LiveMap
            points={[{ id: 'me', lat: d.lat!, lng: d.lng!, label: `${name}'s last location`, tone: emergency ? 'danger' : 'normal' }]}
            label={`Map showing ${name}'s last location`}
          />
        ) : (
          <div className="map-fallback">
            <span className="small muted">No location received yet</span>
          </div>
        )}
        <div className="map-overlay">
          {updated && (
            <span className="chip" data-testid="last-updated">
              <Icon name="clock" size={16} /> Last updated {updated}
            </span>
          )}
          {d.battery_pct != null && (
            <span className={`chip ${lowBattery ? 'red' : ''}`} data-testid="battery">
              <Icon name="battery" size={16} /> Battery {d.battery_pct}%
            </span>
          )}
        </div>
      </div>
      {loadError && (
        <p className="small muted" role="status">
          Couldn&apos;t refresh. Showing the last location we received; trying again…
        </p>
      )}

      <div className="person-row">
        <span className="avatar" aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <div className="grow" style={{ minWidth: 0 }}>
          <strong>{name}</strong>
          <br />
          {d.phone && <span className="small muted">{formatGhanaPhone(d.phone)}</span>}
        </div>
        {hasLocation && (
          <a className="round-btn" href={mapsLink(d.lat!, d.lng!)} target="_blank" rel="noopener noreferrer" aria-label="Open location in Google Maps">
            <Icon name="pin" />
          </a>
        )}
      </div>

      {d.phone && (
        <a className={`btn big block ${emergency ? 'danger' : ''}`} href={telLink(d.phone)} data-testid="call-button">
          <Icon name="phone" /> Call {name}
        </a>
      )}

      {emergency && (
        <section className="card danger" style={{ marginTop: 16 }} aria-labelledby="numbers-title" data-testid="emergency-numbers">
          <h2 id="numbers-title">Can&apos;t reach {name}? Call for help</h2>
          <ul className="emergency-numbers">
            {GHANA_EMERGENCY_NUMBERS.map((n) => (
              <li key={n.number}>
                <a href={telLink(n.number)} aria-label={`Call ${n.label}, ${n.number}`}>
                  <strong>{n.number}</strong>
                  <span className="small">{n.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div style={{ marginTop: 16 }}>{d.details && <Details d={d.details} name={name} />}</div>

      <p className="small muted">
        This page refreshes every 30 seconds and stops working when the trip ends. Only people {name} chose have this
        link.
      </p>
      <GetReached />
    </div>
  );
}
