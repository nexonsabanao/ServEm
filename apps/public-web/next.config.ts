import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  /*
   * The preview panel serves this app from 127.0.0.1 while the dev server
   * announces itself as localhost. Next blocks dev-only resources (the HMR
   * socket, the client chunks it hands out during a rebuild) for any origin it
   * does not recognise, which leaves the page as static HTML with nothing
   * hydrating — every button and every menu silently dead. Both spellings of
   * loopback are the same machine, so both are allowed.
   */
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
};

export default nextConfig;
