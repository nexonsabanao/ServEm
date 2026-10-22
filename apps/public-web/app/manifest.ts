import type { MetadataRoute } from 'next';

/**
 * The installable app.
 *
 * The start URL is the public storefront, not the signed-in home: an install is
 * often opened later by somebody who has since signed out, and a start URL that
 * bounces through a guard would make the icon feel broken. The theme colour is
 * the paper the whole product is drawn on, so the splash screen does not flash
 * white before the first paint.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ServEm — Local services, booked simply',
    short_name: 'ServEm',
    description:
      'Find and book ServMates across Cavite for cleaning, repairs, tutoring, events and errands.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6f5f1',
    theme_color: '#f6f5f1',
    categories: ['business', 'shopping', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
