/**
 * The origin used to build OAuth redirect URIs and post-auth redirects.
 *
 * It is deliberately never derived from the request's Host header: a spoofed
 * host would let an attacker steer the redirect target. Configure APP_ORIGIN in
 * any environment that is not local development. The value must match the
 * redirect URI registered with Google and Apple exactly.
 */
export function resolveAppOrigin(env: NodeJS.ProcessEnv = process.env): string | null {
  const configured = (env.APP_ORIGIN ?? '').trim();
  if (configured) return configured.replace(/\/+$/, '');

  if (env.NODE_ENV !== 'production') {
    const port = (env.PORT ?? '').trim() || '3000';
    return `http://localhost:${port}`;
  }
  return null;
}
