/**
 * paymongoWebhook — HTTP endpoint for PayMongo checkout webhooks.
 *
 * Fails CLOSED at every step:
 *  - If PAYMONGO_WEBHOOK_SECRET is not configured, the endpoint answers 503
 *    and processes nothing.
 *  - Missing/invalid `signature` or `payload_timestamp` headers, replayed
 *    timestamps, or non-JSON bodies all answer 401/400 and are never trusted.
 *  - Idempotency is enforced by the immutable event id in `webhookEvents`.
 *
 * Only recognised "paid" events trigger a payment record, and only when the
 * session carries a `bookingId` in its metadata. Amounts arrive in centavos.
 */
import type { Transaction } from 'firebase-admin/firestore';
import type { Request, Response } from 'express';
import { onRequest } from 'firebase-functions/v2/https';
import { db, serverTs } from './lib/firestore';
import { restrictCors } from './lib/cors';
import { PAYMONGO_WEBHOOK_SECRET, REGION } from './lib/params';
import { verifyPaymongoSignature } from './lib/paymongo';
import { applyPaymentRecord } from './lib/payments';
import { writeAuditLog } from './lib/audit';
import { idSchema } from './lib/validate';

const MAX_BODY_BYTES = 64 * 1024;
const PAID_EVENT_TYPES = new Set(['checkout.session.paid', 'checkout.session.completed']);

async function readRawBody(req: Request): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > MAX_BODY_BYTES) {
      throw Object.assign(new Error('payload too large'), { code: 'payload_too_large' });
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function headerValue(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

export const paymongoWebhook = onRequest(
  { region: REGION, cors: false, timeoutSeconds: 30, memory: '256MiB', secrets: [PAYMONGO_WEBHOOK_SECRET] },
  (req: Request, res: Response) => {
    restrictCors(req, res, () => {
      void handleWebhook(req, res).catch((err) => {
        console.error('[paymongoWebhook] unhandled failure', err);
        if (!res.headersSent) res.status(500).json({ error: 'internal_error' });
      });
    });
  },
);

async function handleWebhook(req: Request, res: Response): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  // 1. Fail closed when the provider is not configured.
  let secret = '';
  try {
    secret = PAYMONGO_WEBHOOK_SECRET.value();
  } catch {
    secret = ''; // secret not configured — endpoint must not process anything
  }
  if (!secret) {
    res.status(503).json({ error: 'paymongo_not_configured' });
    return;
  }

  // 2. Raw body + signature verification.
  let rawBody: string;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    const tooLarge = (err as { code?: string })?.code === 'payload_too_large';
    res.status(tooLarge ? 413 : 400).json({ error: tooLarge ? 'payload_too_large' : 'unreadable_body' });
    return;
  }
  if (
    !verifyPaymongoSignature({
      rawBody,
      signatureHeader: headerValue(req, 'signature'),
      timestampHeader: headerValue(req, 'payload_timestamp'),
      secret,
    })
  ) {
    res.status(401).json({ error: 'invalid_signature' });
    return;
  }

  // 3. Parse the verified payload.
  let event: Record<string, any>;
  try {
    event = JSON.parse(rawBody) as Record<string, any>;
  } catch {
    res.status(400).json({ error: 'invalid_json' });
    return;
  }
  const eventId = typeof event.id === 'string' ? event.id : '';
  const eventType = typeof event.type === 'string' ? event.type : '';
  if (!eventId || !eventType) {
    res.status(400).json({ error: 'malformed_event' });
    return;
  }

  // 4. Idempotency: one processing pass per event id.
  const eventRef = db.collection('webhookEvents').doc(eventId);
  const claimed = await db.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(eventRef);
    if (snap.exists) return { duplicate: true, priorStatus: String(snap.data()?.status ?? '') };
    tx.set(eventRef, {
      provider: 'paymongo',
      eventType,
      payload: { type: eventType, data: event.data ?? null },
      receivedAt: serverTs(),
      status: 'processing',
    });
    return { duplicate: false, priorStatus: '' };
  });
  if (claimed.duplicate) {
    res.status(200).json({ ok: true, duplicate: true, priorStatus: claimed.priorStatus });
    return;
  }

  // 5. Apply recognised payment events. Everything else is acknowledged and
  //    recorded untouched.
  try {
    if (PAID_EVENT_TYPES.has(eventType)) {
      const attrs = (event?.data?.attributes ?? {}) as Record<string, any>;
      const bookingIdRaw = String(attrs?.metadata?.bookingId ?? '');
      const centavos = Number(attrs?.amount);
      if (!bookingIdRaw || !Number.isFinite(centavos) || centavos <= 0) {
        throw new Error('paid event without booking metadata or amount');
      }
      const bookingId = idSchema.parse(bookingIdRaw);
      await applyPaymentRecord({
        bookingId,
        amount: Math.round(centavos) / 100,
        method: 'gcash',
        reference: String(attrs?.id ?? event?.data?.id ?? eventId),
        source: 'paymongo_webhook',
        actorUid: 'paymongo',
      });
    }
    await eventRef.update({ status: 'processed', processedAt: serverTs() });
    res.status(200).json({ ok: true });
  } catch (err) {
    await eventRef
      .update({ status: 'failed', failedAt: serverTs(), error: String((err as Error)?.message ?? err).slice(0, 300) })
      .catch(() => {});
    await writeAuditLog({
      actorUid: 'paymongo',
      actorLabel: 'webhook',
      action: 'webhook.process_failed',
      targetType: 'webhookEvent',
      targetId: eventId,
      detail: { eventType, message: String((err as Error)?.message ?? err).slice(0, 300) },
    });
    // 500 lets PayMongo retry; the signature was already verified so this is safe.
    res.status(500).json({ error: 'processing_failed' });
  }
}
