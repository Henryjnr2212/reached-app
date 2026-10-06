'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { formatGhanaPhone } from '@reached/core';
import { DemoNote } from '@/components/DemoNote';
import { Icon } from '@/components/Icon';
import { OtpSignIn } from '@/components/OtpSignIn';
import { getBackend } from '@/lib/backend';
import type { SignedInUser } from '@/lib/types';

type Step = 'signin' | 'confirm' | 'done';

export function DeleteAccountFlow({ fallback }: { fallback: ReactNode }) {
  const [backend] = useState(getBackend);
  const [step, setStep] = useState<Step>('signin');
  const [user, setUser] = useState<SignedInUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(step);

  // Move focus to the new step's heading so screen readers announce it.
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    headingRef.current?.focus();
  }, [step]);

  if (!backend) return <>{fallback}</>;

  if (step === 'done') {
    return (
      <div className="card success" role="status" data-testid="delete-done">
        <h2 ref={headingRef} tabIndex={-1}>
          Your account has been deleted
        </h2>
        <p>
          Your Reached account and its data have been removed. Your contacts will not get any more messages from you.
          You can uninstall the app from your phone.
        </p>
      </div>
    );
  }

  if (step === 'confirm' && user) {
    return (
      <div className="card danger">
        <h2 ref={headingRef} tabIndex={-1}>
          Delete your Reached account?
        </h2>
        <p>
          Signed in as <strong>{formatGhanaPhone(user.phone)}</strong>. This deletes your account, places, contacts,
          trips, location history and activity. It can&apos;t be undone.
        </p>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="btn-row">
          <button
            type="button"
            className="btn danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await backend.deleteAccount();
                setStep('done');
              } catch {
                setError(
                  "We couldn't delete your account. Your sign-in may have expired: start again and enter a new code. If it keeps failing, email us.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <Icon name="trash" /> {busy ? 'Deleting…' : 'Delete my account'}
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={busy}
            onClick={async () => {
              await backend.signOut();
              setUser(null);
              setStep('signin');
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 ref={headingRef} tabIndex={-1}>
        Delete on the web
      </h2>
      <p className="muted">
        Enter the phone number you use in Reached. We&apos;ll text you a code to confirm it&apos;s you.
      </p>
      <DemoNote>Use any Ghana mobile number and the code 123456.</DemoNote>
      <OtpSignIn
        backend={backend}
        sendLabel="Text me a code"
        onSignedIn={(u) => {
          setUser(u);
          setStep('confirm');
        }}
      />
    </div>
  );
}
