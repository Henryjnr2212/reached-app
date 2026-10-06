import type { Metadata } from 'next';
import { AdminDashboard } from './AdminDashboard';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminPage() {
  return (
    <div className="container">
      <AdminDashboard />
    </div>
  );
}
