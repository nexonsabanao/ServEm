import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Archivo, Fraunces, Space_Mono } from 'next/font/google';
import { PwaRegister } from '@/app/components/pwa-register';
import { getSessionPreferences } from '@/lib/auth';
import './globals.css';
import './feed.css';
import './servmate.css';

const display = Fraunces({
  subsets: ['latin'],
  axes: ['opsz'],
  display: 'swap',
  variable: '--font-display',
});

const body = Archivo({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

const utility = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-utility',
});

export const metadata: Metadata = {
  title: 'ServEm — Local services, booked simply',
  description:
    'Book verified ServMates across Cavite for cleaning, repairs, tutoring, events, and errands.',
  applicationName: 'ServEm',
  /*
   * The manifest is contributed by `app/manifest.ts`; these are the surfaces
   * that read an icon outside it — a browser tab, an iOS home-screen shortcut
   * and the splash screen an installed app shows before its first paint.
   */
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'ServEm',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#F6F5F1',
};

/**
 * The account's accessibility preferences are read here, on the server, and
 * expressed as attributes on `<html>`, so reduced motion and larger text apply
 * on the first painted frame instead of after a client round trip.
 */
export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const preferences = await getSessionPreferences();

  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${utility.variable}`}
      data-motion={preferences.reduceMotion ? 'reduced' : undefined}
      data-text={preferences.largerText ? 'large' : undefined}
    >
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
