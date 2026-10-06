import type { ReactNode } from 'react';
import { DEMO_MODE } from '@/lib/config';

/** Only rendered in NEXT_PUBLIC_DEMO=1 builds. */
export function DemoNote({ children }: { children: ReactNode }) {
  if (!DEMO_MODE) return null;
  return (
    <p className="demo-note" data-testid="demo-note">
      <strong>Demo mode.</strong> {children}
    </p>
  );
}
