import { savePendingAuth } from '@/lib/auth';
import {
  buildAuthorizationUrl,
  createNonce,
  createPkcePair,
  createState,
  getProviderConfig,
  isProviderId,
  redirectUriFor,
} from '@/lib/oauth';
import { resolveAppOrigin } from '@/lib/origin';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  const origin = resolveAppOrigin();

  if (!origin) {
    return Response.json(
      { message: 'Set APP_ORIGIN so OAuth redirects can be built.' },
      { status: 503 },
    );
  }
  if (!isProviderId(provider)) {
    return Response.redirect(`${origin}/?auth_error=unknown_provider`, 303);
  }
  if (!getProviderConfig(provider)) {
    return Response.redirect(`${origin}/?auth_error=${provider}_unavailable`, 303);
  }

  const config = getProviderConfig(provider);
  if (!config) {
    return Response.redirect(`${origin}/?auth_error=${provider}_unavailable`, 303);
  }

  const state = createState();
  const nonce = createNonce();
  const { verifier, challenge } = createPkcePair();

  await savePendingAuth({ state, provider, codeVerifier: verifier, nonce });

  const authorizationUrl = buildAuthorizationUrl({
    provider,
    config,
    redirectUri: redirectUriFor(origin, provider),
    state,
    codeChallenge: challenge,
    nonce,
  });

  return Response.redirect(authorizationUrl, 303);
}
