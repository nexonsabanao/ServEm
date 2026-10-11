import { cookies } from 'next/headers';
import {
  consumePendingAuth,
  sessionCookieOptions,
  signInWithOAuth,
  SESSION_COOKIE,
} from '@/lib/auth';
import {
  exchangeCodeForIdToken,
  getProviderConfig,
  isProviderId,
  redirectUriFor,
  verifyIdToken,
} from '@/lib/oauth';
import { resolveAppOrigin } from '@/lib/origin';

export const dynamic = 'force-dynamic';

type Incoming = {
  code: string;
  state: string;
  error: string;
  appleUser: string;
};

async function readIncoming(request: Request): Promise<Incoming> {
  const incoming: Incoming = { code: '', state: '', error: '', appleUser: '' };

  if (request.method === 'GET') {
    const params = new URL(request.url).searchParams;
    incoming.code = params.get('code') ?? '';
    incoming.state = params.get('state') ?? '';
    incoming.error = params.get('error') ?? '';
    return incoming;
  }

  // Apple posts the authorization response back as form data.
  const form = await request.formData().catch(() => null);
  if (form) {
    incoming.code = String(form.get('code') ?? '');
    incoming.state = String(form.get('state') ?? '');
    incoming.error = String(form.get('error') ?? '');
    incoming.appleUser = String(form.get('user') ?? '');
  }
  return incoming;
}

/** Apple only sends the person's name on the very first authorization. */
function nameFromAppleUser(raw: string): string {
  if (!raw) return '';
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return '';
    const name = (parsed as { name?: { firstName?: unknown; lastName?: unknown } }).name;
    if (!name) return '';
    const parts = [name.firstName, name.lastName].filter(
      (part): part is string => typeof part === 'string' && part.trim().length > 0,
    );
    return parts.join(' ').trim();
  } catch {
    return '';
  }
}

async function handle(request: Request, providerParam: string): Promise<Response> {
  const origin = resolveAppOrigin();
  if (!origin) {
    return Response.json(
      { message: 'Set APP_ORIGIN so OAuth redirects can be built.' },
      { status: 503 },
    );
  }
  if (!isProviderId(providerParam)) {
    return Response.redirect(`${origin}/?auth_error=unknown_provider`, 303);
  }

  const provider = providerParam;
  const incoming = await readIncoming(request);

  if (incoming.error) {
    return Response.redirect(
      `${origin}/?auth_error=${encodeURIComponent(`${provider}_denied`)}`,
      303,
    );
  }
  if (!incoming.code || !incoming.state) {
    return Response.redirect(`${origin}/?auth_error=oauth_incomplete`, 303);
  }

  // Single-use state: a missing or replayed state means the flow did not start here.
  const pending = await consumePendingAuth(incoming.state);
  if (!pending || pending.provider !== provider) {
    return Response.redirect(`${origin}/?auth_error=oauth_state`, 303);
  }

  const config = getProviderConfig(provider);
  if (!config) {
    return Response.redirect(`${origin}/?auth_error=${provider}_unavailable`, 303);
  }

  let idToken: string;
  try {
    idToken = await exchangeCodeForIdToken({
      provider,
      config,
      code: incoming.code,
      redirectUri: redirectUriFor(origin, provider),
      codeVerifier: pending.codeVerifier,
    });
  } catch {
    return Response.redirect(`${origin}/?auth_error=${provider}_exchange`, 303);
  }

  let identity;
  try {
    identity = await verifyIdToken({
      provider,
      idToken,
      clientId: config.clientId,
      nonce: pending.nonce,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'id_token';
    return Response.redirect(`${origin}/?auth_error=${encodeURIComponent(reason)}`, 303);
  }

  if (!identity.email || !identity.emailVerified) {
    return Response.redirect(`${origin}/?auth_error=email_unverified`, 303);
  }

  const result = await signInWithOAuth({
    provider,
    subject: identity.subject,
    email: identity.email,
    name: identity.name || nameFromAppleUser(incoming.appleUser),
  });

  (await cookies()).set(SESSION_COOKIE, result.token, sessionCookieOptions());
  return Response.redirect(`${origin}/home`, 303);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  return handle(request, provider);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  return handle(request, provider);
}
