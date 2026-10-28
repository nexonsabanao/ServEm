/**
 * Booking chat. Clients can read a thread only if they are a member (rules),
 * but they can never write messages directly — append goes through this
 * callable, which enforces membership, length, rate limiting, and stores
 * sanitised plain text.
 */
import type { Transaction } from 'firebase-admin/firestore';
import { z } from 'zod';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { db, assertSafePathSegment, serverTs } from './lib/firestore';
import { CORS_REGEX } from './lib/cors';
import { REGION } from './lib/params';
import { requireAuth } from './lib/guards';
import { enforceRateLimit } from './lib/rateLimit';
import { idSchema, parseInput, sanitizedText } from './lib/validate';

const MAX_MESSAGES_PER_THREAD = 500;

const sendMessageSchema = z.object({
  threadId: idSchema,
  text: sanitizedText(1, 2000),
});

export const sendBookingMessage = onCall(
  { region: REGION, cors: CORS_REGEX, timeoutSeconds: 20, memory: '128MiB' },
  async (req: CallableRequest) => {
    const authed = requireAuth(req);
    const input = parseInput(sendMessageSchema, req.data);
    assertSafePathSegment(input.threadId);

    // 20 messages/minute keeps chat usable while blocking spam.
    await enforceRateLimit('sendBookingMessage', authed.uid, 20, 60);

    const threadRef = db.collection('threads').doc(input.threadId);
    const message = {
      senderId: authed.uid,
      text: input.text,
      readBy: [authed.uid],
      sentAt: new Date().toISOString(),
    };

    await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(threadRef);
      if (!snap.exists) throw new HttpsError('not-found', 'Thread not found.');
      const thread = (snap.data() ?? {}) as Record<string, any>;
      const members: string[] = Array.isArray(thread.members) ? thread.members : [];
      if (!members.includes(authed.uid)) {
        throw new HttpsError('permission-denied', 'You are not a member of this thread.');
      }
      const messages: unknown[] = Array.isArray(thread.messages) ? thread.messages : [];
      if (messages.length >= MAX_MESSAGES_PER_THREAD) {
        throw new HttpsError('resource-exhausted', 'This thread has reached its message cap.');
      }
      tx.update(threadRef, {
        messages: [...messages, message],
        updatedAt: serverTs(),
      });
    });

    // Notify the other member (best effort; never fails the send).
    try {
      const threadSnap = await threadRef.get();
      const members: string[] = (threadSnap.data() as Record<string, any>)?.members ?? [];
      for (const uid of members.filter((m) => m !== authed.uid)) {
        await db.collection('notifications').add({
          uid,
          kind: 'message',
          title: 'New message',
          body: input.text.slice(0, 120),
          threadId: input.threadId,
          read: false,
          createdAt: serverTs(),
        });
      }
    } catch (err) {
      console.warn('[sendBookingMessage] notification failed', err);
    }

    return { threadId: input.threadId, sent: true };
  },
);
