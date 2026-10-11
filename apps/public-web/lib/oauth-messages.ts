import type { OAuthProvider } from './store';

/**
 * Turns the `?auth=` / `?auth_error=` values set by the OAuth callback into
 * messages a person can act on. Every code the routes can emit is mapped here,
 * including the ones that only occur when a provider is not configured.
 */

const LABELS: Record<OAuthProvider, string> = { google: 'Google', apple: 'Apple' };
const PROVIDERS: OAuthProvider[] = ['google', 'apple'];

export function signedInNotice(provider: string): string {
  const match = PROVIDERS.find((candidate) => candidate === provider);
  return match ? `Signed in with ${LABELS[match]}.` : '';
}

export function authErrorNotice(rawCode: string): string {
  const code = (rawCode ?? '').trim();
  if (!code) return '';

  for (const provider of PROVIDERS) {
    const label = LABELS[provider];
    if (code === `${provider}_unavailable`) {
      return `${label} sign-in is not configured on this server yet.`;
    }
    if (code === `${provider}_denied`) {
      return `${label} sign-in was cancelled.`;
    }
    if (code === `${provider}_exchange`) {
      return `Could not finish signing in with ${label}. Try again.`;
    }
  }

  switch (code) {
    case 'oauth_state':
      return 'That sign-in link expired. Start again.';
    case 'oauth_incomplete':
      return 'The sign-in response was incomplete. Try again.';
    case 'unknown_provider':
      return 'That sign-in provider is not supported.';
    case 'email_unverified':
      return 'That account has no verified email address, so it cannot be used here.';
    default:
      if (code.startsWith('id_token_')) {
        return 'The sign-in response could not be verified. Try again.';
      }
      return 'Sign-in did not complete. Try again.';
  }
}
