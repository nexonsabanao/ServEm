import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'ServEm — Find good people for good work',
  description:
    'Explore published services from independent providers and find the right help for your next project.',
  applicationName: 'ServEm',
};

export const viewport: Viewport = {
  themeColor: '#F6F5F1',
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
