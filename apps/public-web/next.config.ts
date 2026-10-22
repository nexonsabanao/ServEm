import type { NextConfig } from 'next';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * The policy every response carries.
 *
 * It is deliberately built from fail-closed defaults: nothing may load from
 * another origin, nothing may frame this site, and no plugin or `<base>` tag
 * may rewrite where a request goes. Two allowances are unavoidable without a
 * nonce pipeline: `script-src 'unsafe-inline'` (Next's App Router emits its
 * bootstrap inline) and `style-src 'unsafe-inline'` (next/font and the app's
 * style attributes). Both still confine inline code to this origin, so an
 * injected script cannot pull a payload from elsewhere.
 *
 * `connect-src` admits the dev server's HMR websocket in development only, and
 * `upgrade-insecure-requests` is production-only so local HTTP keeps working.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isProduction ? '' : ' ws: wss:'}`,
  "media-src 'self' blob:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProduction ? ['upgrade-insecure-requests'] : []),
].join('; ');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  /*
   * Applied to every response, routed and static. The header set answers the
   * four cheapest classes of browser-side attack: clickjacking is stopped by
   * `frame-ancestors`/`X-Frame-Options`, MIME sniffing by `nosniff`, referrer
   * leakage by trimming cross-origin referrers to the origin, and injected
   * markup by the CSP above. HSTS is production-only: sending it from a local
   * HTTP server would pin the developer's browser to HTTPS for localhost.
   */
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          ...(isProduction
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=31536000; includeSubDomains',
                },
              ]
            : []),
        ],
      },
    ];
  },
  /*
   * The preview panel serves this app from 127.0.0.1 while the dev server
   * announces itself as localhost. Next blocks dev-only resources (the HMR
   * socket, the client chunks it hands out during a rebuild) for any origin it
   * does not recognise, which leaves the page as static HTML with nothing
   * hydrating — every button and every menu silently dead. Both spellings of
   * loopback are the same machine, so both are allowed.
   */
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  /*
   * `next dev` holds a native lock on `<distDir>/dev/lock` and refuses to start
   * a second server for one project, which is what the e2e run needs: it starts
   * its own server beside yours. Pointing the run at its own build directory
   * gives it a separate lock — and a separate cache, so its cold compiles never
   * touch the build the preview is serving from. Unset for ordinary dev.
   */
  distDir: process.env.SERVEM_DIST_DIR ?? '.next',
};

export default nextConfig;
