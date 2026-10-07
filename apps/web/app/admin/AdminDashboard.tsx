'use client';

import { useCallback, useEffect, useState } from 'react';
import { StaffGate } from '@/components/StaffGate';
import type { Backend } from '@/lib/backend';
import { NotAllowedError } from '@/lib/errors';
import type { AdminStats } from '@/lib/types';

const nf = new Intl.NumberFormat('en-GH');

const FEEDBACK_LABELS: Record<string, string> = {
  not_arrived: "I hadn't arrived yet",
  wrong_place: 'Wrong place',
  should_not_send: "Shouldn't have sent",
};

const MESSAGE_ORDER = ['delivered', 'sent', 'sending', 'pending', 'held', 'failed', 'opted_out', 'cancelled'];

function Stat({ name, value, testId }: { name: string; value: number; testId?: string }) {
  return (
    <div className="stat" data-testid={testId}>
      <span className="value">{nf.format(value)}</span>
      <span className="name">{name}</span>
    </div>
  );
}

function Breakdown({ title, data, labels, order }: { title: string; data: Record<string, number>; labels?: Record<string, string>; order?: string[] }) {
  const keys = Object.keys(data).sort((a, b) => {
    if (!order) return (data[b] ?? 0) - (data[a] ?? 0);
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const total = keys.reduce((s, k) => s + (data[k] ?? 0), 0);
  const titleId = `bd-${title.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <section className="card" aria-labelledby={titleId}>
      <h2 id={titleId}>{title}</h2>
      {keys.length === 0 ? (
        <p className="muted">Nothing yet.</p>
      ) : (
        <ul className="list">
          {keys.map((k) => {
            const n = data[k] ?? 0;
            const pct = total ? Math.round((n / total) * 100) : 0;
            const label = labels?.[k] ?? k.replace(/_/g, ' ');
            return (
              <li key={k}>
                <span className="grow">
                  <span className="label" style={{ textTransform: labels?.[k] ? 'none' : 'capitalize' }}>
                    {label}
                  </span>
                  <span
                    aria-hidden="true"
                    style={{ display: 'block', height: 6, borderRadius: 999, background: 'var(--c-surface-muted)', marginTop: 6 }}
                  >
                    <span style={{ display: 'block', height: 6, width: `${pct}%`, borderRadius: 999, background: k === 'failed' ? 'var(--c-danger)' : 'var(--c-primary)' }} />
                  </span>
                </span>
                <strong>{nf.format(n)}</strong>
                <span className="small muted" style={{ width: 44, textAlign: 'right' }}>
                  {pct}%
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Stats({ backend }: { backend: Backend }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setStats(await backend.adminStats());
      setError(false);
    } catch (e) {
      if (e instanceof NotAllowedError) setBlocked(true);
      else setError(true);
    }
  }, [backend]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (blocked) {
    return (
      <div className="card warning" data-testid="not-admin">
        <h2>Admins only</h2>
        <p>This account doesn&apos;t have admin access. Sign out and use an admin account.</p>
      </div>
    );
  }
  if (!stats) {
    return error ? (
      <div className="card" role="alert">
        <p>Couldn&apos;t load the numbers.</p>
        <button type="button" className="btn" onClick={() => void load()}>
          Try again
        </button>
      </div>
    ) : (
      <div className="skeleton" style={{ height: 240 }} role="status" aria-label="Loading" />
    );
  }

  const plans = Object.entries(stats.plans);
  return (
    <div data-testid="admin-stats">
      <div className="grid stats" style={{ marginBottom: 16 }}>
        <Stat name="Users" value={stats.users} testId="stat-users" />
        <Stat name="Onboarded" value={stats.onboarded} />
        <Stat name="Live trips now" value={stats.live_trips} />
        <Stat name="Open SOS" value={stats.open_sos} testId="stat-open-sos" />
        <Stat name="Arrivals (7 days)" value={stats.arrivals_7d} />
        <Stat name="Problem reports (7 days)" value={stats.problem_reports_7d} />
        {plans.map(([plan, n]) => (
          <Stat key={plan} name={`${plan[0]?.toUpperCase()}${plan.slice(1)} plan`} value={n} />
        ))}
      </div>
      <div className="grid">
        <Breakdown title="Messages by status (7 days)" data={stats.messages_7d} order={MESSAGE_ORDER} />
        <Breakdown title="Arrival feedback (7 days)" data={stats.feedback_7d} labels={FEEDBACK_LABELS} />
      </div>
    </div>
  );
}

export function AdminDashboard() {
  return (
    <StaffGate title="Reached admin" intro="Sign in with an admin phone number." demoHint="Admin: 020 000 0002. Code 123456.">
      {({ backend }) => (
        <>
          <h1>Admin overview</h1>
          <p className="muted">Counts only. No personal data is shown here.</p>
          <Stats backend={backend} />
        </>
      )}
    </StaffGate>
  );
}
