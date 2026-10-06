import type { Metadata } from 'next';
import { LiveView } from './LiveView';

export const metadata: Metadata = {
  title: 'Live location',
  description: 'A live location shared with you through Reached.',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export default async function LivePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <LiveView token={token} />;
}
