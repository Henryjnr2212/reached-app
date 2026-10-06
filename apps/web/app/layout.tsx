import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { dark, light } from '@reached/core';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { SITE_URL } from '@/lib/config';
import { bootScript, themeCss } from '@/lib/theme';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Reached — let your people know you got there', template: '%s · Reached' },
  description:
    'Reached texts your chosen contacts when you arrive safely, and alerts them if you are overdue or need help. Made for Ghana. Your people never need the app.',
  applicationName: 'Reached',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: light.background },
    { media: '(prefers-color-scheme: dark)', color: dark.background },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GH" suppressHydrationWarning>
      <head>
        <style id="reached-tokens" dangerouslySetInnerHTML={{ __html: themeCss }} />
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
