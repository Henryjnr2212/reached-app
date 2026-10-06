'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { formatGhanaPhone } from '@reached/core';
import type { Backend } from '@/lib/backend';
import { getBackend } from '@/lib/backend';
import type { SignedInUser } from '@/lib/types';
import { DemoNote } from './DemoNote';
import { OtpSignIn } from './OtpSignIn';

interface Props {
  title: string;
  intro: string;
  demoHint: string;
  children: (ctx: { backend: Backend; user: SignedInUser; signOut: () => Promise<void> }) => ReactNode;
}

/** Phone OTP sign-in in front of the police and admin dashboards. */
export function StaffGate({ title, intro, demoHint, children }: Props) {
  const [backend] = useState(getBackend);
  const [user, setUser] = useState<SignedInUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!backend) {
      setChecking(false);
      return;
    }
    backend
      .currentUser()
      .then((u) => alive && setUser(u))
      .catch(() => undefined)
      .finally(() => alive && setChecking(false));
    return () => {
      alive = false;
    };
  }, [backend]);

  if (!backend) {
    return (
      <div className="card">
        <h1>{title}</h1>
        <p className="muted">Sign-in isn&apos;t set up on this site yet.</p>
      </div>
    );
  }

  if (checking) {
    return <div className="skeleton" style={{ height: 220 }} aria-busy="true" aria-label="Loading" />;
  }

  if (!user) {
    return (
      <div className="card" style={{ maxWidth: 480, margin: '0 auto' }}>
        <h1>{title}</h1>
        <p className="muted">{intro}</p>
        <DemoNote>{demoHint}</DemoNote>
        <OtpSignIn backend={backend} onSignedIn={setUser} sendLabel="Text me a code" />
      </div>
    );
  }

  const signOut = async () => {
    await backend.signOut();
    setUser(null);
  };

  return (
    <>
      <div className="toolbar">
        <span className="small muted">Signed in as {formatGhanaPhone(user.phone)}</span>
        <button type="button" className="btn ghost" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
      {children({ backend, user, signOut })}
    </>
  );
}
