/**
 * PayMongo webhook signature verification.
 *
 * Documented provider scheme (fail closed on every deviation):
 *   - Header `payload_timestamp`: unix seconds of the delivery.
 *   - Header `signature`: hex HMAC-SHA256 over `${payload_timestamp}.${rawBody}`
 *     keyed with the webhook signing secret from the endpoint configuration.
 *
 * We additionally require the timestamp to be within 5 minutes of receipt to
 * blunt replay attacks. Idempotency by event id is enforced by the caller.
 *
 * NOTE: this reflects PayMongo's published scheme as implemented without live
 * credentials. Verify against a real webhook delivery in staging before
 * trusting production traffic (see SECURITY.md "Unverified items").
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const REPLAY_WINDOW_SECONDS = 300;

function safeHexEqual(a: string, b: string): boolean {
  if (!/^[0-9a-fA-F]+$/.test(a) || !/^[0-9a-fA-F]+$/.test(b)) return false;
  const bufA = Buffer.from(a.toLowerCase(), 'hex');
  const bufB = Buffer.from(b.toLowerCase(), 'hex');
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function verifyPaymongoSignature(params: {
  rawBody: string;
  signatureHeader: string | undefined;
  timestampHeader: string | undefined;
  secret: string;
  nowMs?: number;
}): boolean {
  const { rawBody, signatureHeader, timestampHeader, secret } = params;
  if (!secret || !signatureHeader || !timestampHeader || !rawBody) return false;

  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts) || ts <= 0) return false;
  const ageSec = Math.abs((params.nowMs ?? Date.now()) / 1000 - ts);
  if (ageSec > REPLAY_WINDOW_SECONDS) return false;

  const expected = createHmac('sha256', secret).update(`${timestampHeader}.${rawBody}`).digest('hex');
  return safeHexEqual(expected, signatureHeader.trim());
}
