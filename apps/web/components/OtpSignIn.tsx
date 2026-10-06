'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { formatGhanaPhone, normalizeGhanaPhone } from '@reached/core';
import type { Backend } from '@/lib/backend';
import { OtpError } from '@/lib/errors';
import type { SignedInUser } from '@/lib/types';

interface Props {
  backend: Backend;
  onSignedIn: (user: SignedInUser) => void;
  /** Button text on the phone step. */
  sendLabel?: string;
  /** Extra help shown under the phone field. */
  phoneHint?: string;
}

/** Two-step phone sign-in: Ghana number → 6-digit SMS code. */
export function OtpSignIn({ backend, onSignedIn, sendLabel = 'Send code', phoneHint }: Props) {
  const ids = { phone: useId(), phoneErr: useId(), code: useId(), codeErr: useId(), phoneHint: useId() };
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [raw, setRaw] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus();
  }, [step]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    setNotice(null);
    const e164 = normalizeGhanaPhone(raw);
    if (!e164) {
      setError('Enter a Ghana mobile number, like 024 123 4567.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await backend.sendOtp(e164);
      setPhone(e164);
      setStep('code');
      setCode('');
    } catch {
      setError("We couldn't send a code to that number. Check it is the number you use in the Reached app, then try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!phone) return;
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from the text message.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const user = await backend.verifyOtp(phone, code);
      onSignedIn(user);
    } catch (err) {
      setError(
        err instanceof OtpError
          ? "That code didn't work. Check it and try again, or send a new code."
          : 'Something went wrong. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (step === 'phone') {
    return (
      <form onSubmit={send} noValidate>
        <div className="field">
          <label htmlFor={ids.phone}>Phone number</label>
          <input
            id={ids.phone}
            className="input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="024 123 4567"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={[phoneHint ? ids.phoneHint : '', error ? ids.phoneErr : ''].filter(Boolean).join(' ') || undefined}
          />
          {phoneHint && (
            <p className="hint" id={ids.phoneHint}>
              {phoneHint}
            </p>
          )}
          {error && (
            <p className="field-error" id={ids.phoneErr} role="alert">
              {error}
            </p>
          )}
        </div>
        <button type="submit" className="btn block" disabled={busy}>
          {busy ? 'Sending…' : sendLabel}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} noValidate>
      <p>
        We sent a 6-digit code to <strong>{phone ? formatGhanaPhone(phone) : ''}</strong>.
      </p>
      <div className="field">
        <label htmlFor={ids.code}>6-digit code</label>
        <input
          ref={codeRef}
          id={ids.code}
          className="input"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? ids.codeErr : undefined}
        />
        {error && (
          <p className="field-error" id={ids.codeErr} role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="hint" role="status">
            {notice}
          </p>
        )}
      </div>
      <button type="submit" className="btn block" disabled={busy}>
        {busy ? 'Checking…' : 'Verify'}
      </button>
      <div className="btn-row">
        <button
          type="button"
          className="link-btn"
          onClick={async () => {
            await send();
            setNotice('We sent a new code.');
          }}
        >
          Send a new code
        </button>
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setStep('phone');
            setError(null);
            setNotice(null);
          }}
        >
          Change number
        </button>
      </div>
    </form>
  );
}
