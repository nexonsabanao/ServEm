import {
  createHash,
  createPublicKey,
  createSign,
  randomBytes,
  verify as cryptoVerify,
} from 'node:crypto';
import type { JsonWebKey } from 'node:crypto';
import type { OAuthProvider } from './store';

/**
 * Google and Apple sign-in.
 *
 * Nothing here works until real credentials are supplied through environment
 * variables (see README). No client ids, secrets or keys are bundled, and the
 * flows are never simulated: without configuration the routes report that the
 * provider is unavailable rather than pretending to sign anyone in.
 */

export type ProviderId = OAuthProvider;

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

const APPLE_AUTH_ENDPOINT = 'https://appleid.apple.com/auth/authorize';
const APPLE_TOKEN_ENDPOINT = 'https://appleid.apple.com/auth/token';
const APPLE_JWKS_URI = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';

const NETWORK_TIMEOUT_MS = 10_000;
const JWKS_TTL_MS = 60 * 60 * 1000;

export type GoogleConfig = { provider: 'google'; clientId: string; clientSecret: string };
export type AppleConfig = {
  provider: 'apple';
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
};

export type ProviderConfig = GoogleConfig | AppleConfig;

function clean(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Private keys are often stored with escaped newlines in environment variables. */
function normalisePrivateKey(value: string): string {
  return value.replace(/\\n/g, '\n').trim();
}

export function googleConfig(env: NodeJS.ProcessEnv = process.env): GoogleConfig | null {
  const clientId = clean(env.GOOGLE_CLIENT_ID);
  const clientSecret = clean(env.GOOGLE_CLIENT_SECRET);
  if (!clientId || !clientSecret) return null;
  return { provider: 'google', clientId, clientSecret };
}

export function appleConfig(env: NodeJS.ProcessEnv = process.env): AppleConfig | null {
  const clientId = clean(env.APPLE_CLIENT_ID);
  const teamId = clean(env.APPLE_TEAM_ID);
  const keyId = clean(env.APPLE_KEY_ID);
  const privateKey = normalisePrivateKey(clean(env.APPLE_PRIVATE_KEY));
  if (!clientId || !teamId || !keyId || !privateKey) return null;
  return { provider: 'apple', clientId, teamId, keyId, privateKey };
}

export function getProviderConfig(
  provider: ProviderId,
  env: NodeJS.ProcessEnv = process.env,
): ProviderConfig | null {
  return provider === 'google' ? googleConfig(env) : appleConfig(env);
}

export function providerAvailability(env: NodeJS.ProcessEnv = process.env) {
  return {
    google: googleConfig(env) !== null,
    apple: appleConfig(env) !== null,
  };
}

export function isProviderId(value: string): value is ProviderId {
  return value === 'google' || value === 'apple';
}

export function redirectUriFor(origin: string, provider: ProviderId): string {
  return new URL(`/api/auth/oauth/${provider}/callback`, origin).toString();
}

function base64UrlEncode(input: Buffer | string): string {
  const buffer = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buffer.toString('base64url');
}

function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = base64UrlEncode(randomBytes(32));
  const challenge = base64UrlEncode(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export function createState(): string {
  return base64UrlEncode(randomBytes(24));
}

export function createNonce(): string {
  return base64UrlEncode(randomBytes(16));
}

/**
 * Apple requires the client secret to be a short-lived ES256 JWT rather than a
 * static string. ES256 needs the raw r||s signature encoding, so `dsaEncoding`
 * must be `ieee-p1363` (the JWS spec form, not DER).
 */
export function buildAppleClientSecret(input: {
  teamId: string;
  keyId: string;
  clientId: string;
  privateKey: string;
  nowSeconds?: number;
}): string {
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(
    JSON.stringify({ alg: 'ES256', kid: input.keyId, typ: 'JWT' }),
  );
  const claims = base64UrlEncode(
    JSON.stringify({
      iss: input.teamId,
      iat: now,
      exp: now + 60 * 60 * 24 * 180,
      aud: APPLE_ISSUER,
      sub: input.clientId,
    }),
  );
  const signingInput = `${header}.${claims}`;
  const signature = createSign('sha256')
    .update(signingInput)
    .sign({ key: input.privateKey, dsaEncoding: 'ieee-p1363' });
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

export function buildAuthorizationUrl(input: {
  provider: ProviderId;
  config: ProviderConfig;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  nonce: string;
}): string {
  const url =
    input.provider === 'google'
      ? new URL(GOOGLE_AUTH_ENDPOINT)
      : new URL(APPLE_AUTH_ENDPOINT);

  url.searchParams.set('client_id', input.config.clientId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', input.state);
  url.searchParams.set('nonce', input.nonce);
  url.searchParams.set('code_challenge', input.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');

  if (input.provider === 'apple') {
    // Apple replies to the redirect URI with a form POST, which is what the
    // callback route accepts alongside GET.
    url.searchParams.set('response_mode', 'form_post');
  }
  return url.toString();
}

export async function exchangeCodeForIdToken(input: {
  provider: ProviderId;
  config: ProviderConfig;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<string> {
  const body = new URLSearchParams({
    code: input.code,
    client_id: input.config.clientId,
    redirect_uri: input.redirectUri,
    grant_type: 'authorization_code',
    code_verifier: input.codeVerifier,
  });

  const endpoint =
    input.provider === 'google' ? GOOGLE_TOKEN_ENDPOINT : APPLE_TOKEN_ENDPOINT;

  body.set(
    'client_secret',
    input.config.provider === 'google'
      ? input.config.clientSecret
      : buildAppleClientSecret({
          teamId: input.config.teamId,
          keyId: input.config.keyId,
          clientId: input.config.clientId,
          privateKey: input.config.privateKey,
        }),
  );

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !isRecord(payload) || typeof payload.id_token !== 'string') {
    throw new Error('token_exchange_failed');
  }
  return payload.id_token;
}

type Jwk = { kid?: string; kty?: string; n?: string; e?: string; alg?: string; use?: string };

let jwksCache: { uri: string; keys: Jwk[]; fetchedAt: number } | null = null;

async function fetchSigningKeys(uri: string, forceRefresh = false): Promise<Jwk[]> {
  if (
    !forceRefresh &&
    jwksCache &&
    jwksCache.uri === uri &&
    Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS
  ) {
    return jwksCache.keys;
  }

  const response = await fetch(uri, {
    cache: 'no-store',
    signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error('jwks_unavailable');

  const payload: unknown = await response.json().catch(() => null);
  const keys =
    isRecord(payload) && Array.isArray(payload.keys)
      ? payload.keys.filter(
          (candidate): candidate is Jwk => isRecord(candidate) && candidate.kty === 'RSA',
        )
      : [];
  if (keys.length === 0) throw new Error('jwks_empty');

  jwksCache = { uri, keys, fetchedAt: Date.now() };
  return keys;
}

export type VerifiedIdentity = {
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string;
};

export async function verifyIdToken(input: {
  provider: ProviderId;
  idToken: string;
  clientId: string;
  nonce: string | null;
}): Promise<VerifiedIdentity> {
  const parts = input.idToken.split('.');
  if (parts.length !== 3) throw new Error('id_token_malformed');
  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];

  const header: unknown = JSON.parse(base64UrlDecode(headerPart).toString('utf8'));
  const payload: unknown = JSON.parse(base64UrlDecode(payloadPart).toString('utf8'));
  if (!isRecord(header) || !isRecord(payload)) throw new Error('id_token_malformed');
  if (header.alg !== 'RS256') throw new Error('id_token_algorithm');

  const jwksUri = input.provider === 'google' ? GOOGLE_JWKS_URI : APPLE_JWKS_URI;
  let keys = await fetchSigningKeys(jwksUri);
  let key = keys.find((candidate) => candidate.kid === header.kid);
  if (!key) {
    // The provider may have rotated keys; refresh once before rejecting.
    keys = await fetchSigningKeys(jwksUri, true);
    key = keys.find((candidate) => candidate.kid === header.kid);
  }
  if (!key) throw new Error('id_token_key_not_found');

  const publicKey = createPublicKey({ key: key as JsonWebKey, format: 'jwk' });
  const signatureValid = cryptoVerify(
    'sha256',
    Buffer.from(`${headerPart}.${payloadPart}`),
    publicKey,
    base64UrlDecode(signaturePart),
  );
  if (!signatureValid) throw new Error('id_token_signature');

  const allowedIssuers = input.provider === 'google' ? GOOGLE_ISSUERS : [APPLE_ISSUER];
  if (typeof payload.iss !== 'string' || !allowedIssuers.includes(payload.iss)) {
    throw new Error('id_token_issuer');
  }

  const audience = payload.aud;
  const audienceMatches =
    audience === input.clientId ||
    (Array.isArray(audience) && audience.includes(input.clientId));
  if (!audienceMatches) throw new Error('id_token_audience');

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < nowSeconds - 60) {
    throw new Error('id_token_expired');
  }

  if (input.nonce !== null && payload.nonce !== input.nonce) {
    throw new Error('id_token_nonce');
  }

  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('id_token_subject');
  }

  return {
    subject: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : '',
    emailVerified: payload.email_verified === true || payload.email_verified === 'true',
    name: typeof payload.name === 'string' ? payload.name : '',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
