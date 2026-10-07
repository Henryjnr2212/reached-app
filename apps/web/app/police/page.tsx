import type { Metadata } from 'next';
import { PoliceDashboard } from './PoliceDashboard';

export const metadata: Metadata = {
  title: 'Police dashboard',
  robots: { index: false, follow: false, nocache: true },
};

export default function PolicePage() {
  return (
    <div className="container">
      <PoliceDashboard />
    </div>
  );
}
