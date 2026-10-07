'use client';

import { useEffect, useState } from 'react';
import { THEME_STORAGE_KEY } from '@/lib/theme';
import { Icon } from './Icon';

type Mode = 'light' | 'dark';

function effectiveMode(): Mode {
  const set = document.documentElement.getAttribute('data-theme');
  if (set === 'light' || set === 'dark') return set;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Light/dark switch. Follows the phone until the visitor picks one; the pick is remembered. */
export function ThemeToggle() {
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    setMode(effectiveMode());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setMode(effectiveMode());
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const next: Mode = mode === 'dark' ? 'light' : 'dark';
  const label = mode ? `Switch to ${next} mode` : 'Switch colour mode';

  return (
    <button
      type="button"
      className="round-btn"
      aria-label={label}
      title={label}
      data-mode={mode ?? undefined}
      onClick={() => {
        const target = mode ? next : effectiveMode() === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', target);
        try {
          localStorage.setItem(THEME_STORAGE_KEY, target);
        } catch {
          // Private mode: the choice just isn't remembered.
        }
        setMode(target);
      }}
    >
      <Icon name={mode === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}
