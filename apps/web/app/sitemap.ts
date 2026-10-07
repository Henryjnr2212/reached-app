import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/config';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/help', '/privacy', '/terms', '/delete-account'].map((p) => ({ url: `${SITE_URL}${p}` }));
}
