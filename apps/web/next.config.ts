import type { NextConfig } from 'next';

const noindex = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }];

const nextConfig: NextConfig = {
  // @reached/core ships TypeScript source with `.ts` extension imports.
  transpilePackages: ['@reached/core'],
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      // Private pages are never indexed (also set with <meta name="robots">).
      { source: '/l/:path*', headers: noindex },
      { source: '/police', headers: noindex },
      { source: '/admin', headers: noindex },
    ];
  },
};

export default nextConfig;
