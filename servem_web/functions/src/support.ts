/**
 * Support tickets. Any authenticated user may create a ticket for themselves
 * and (via rules) read their own tickets; only admins may reply through the
 * separate replySupportTicket callable.
 */
import type { Transaction } from 'firebase-admin/firestore';
import { z } from 'zod';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { db, assertSafePathSegment, serverTs } from './lib/firestore';
import { CORS_REGEX } from './lib/cors';
import { REGION } from './lib/params';
import { requireAdmin, requireAuth } from './lib/guards';
import { enforceRateLimit } from './lib/rateLimit';
import { writeAuditLog } from './lib/audit';
import { notify } from './lib/notify';
import { idSchema, parseInput, prioritySchema, sanitizedText } from './lib/validate';

const createTicketSchema = z.object({
  subject: sanitizedText(3, 120),
  body: sanitizedText(10, 2000),
  priority: prioritySchema.optional().default('normal'),
  bookingId: idSchema.optional(),
});

export const createSupportTicket = onCall(
  { region: REGION, cors: CORS_REGEX, timeoutSeconds: 20, memory: '128MiB' },
  async (req: CallableRequest) => {
    const authed = requireAuth(req);
    const input = parseInput(createTicketSchema, req.data);
    await enforceRateLimit('createSupportTicket', authed.uid, 5, 10 * 60);

    if (input.bookingId) assertSafePathSegment(input.bookingId);

    const ticketRef = await db.collection('tickets').add({
      uid: authed.uid,
      userEmail: authed.email ?? '',
      subject: input.subject,
      body: input.body,
      priority: input.priority,
      bookingId: input.bookingId ?? null,
      status: 'open',
      replies: [],
      createdAt: serverTs(),
      updatedAt: serverTs(),
    });

    await writeAuditLog({
      actorUid: authed.uid,
      actorLabel: 'user',
      action: 'ticket.created',
      targetType: 'ticket',
      targetId: ticketRef.id,
      detail: { priority: input.priority, subject: input.subject },
    });

    return { ticketId: ticketRef.id, status: 'open' };
  },
);

const replyTicketSchema = z.object({
  ticketId: idSchema,
  reply: sanitizedText(1, 2000),
  setStatus: z.enum(['waiting', 'resolved', 'open']).optional(),
});

export const replySupportTicket = onCall(
  { region: REGION, cors: CORS_REGEX, timeoutSeconds: 20, memory: '128MiB' },
  async (req: CallableRequest) => {
    const authed = requireAdmin(req);
    const input = parseInput(replyTicketSchema, req.data);
    assertSafePathSegment(input.ticketId);
    await enforceRateLimit('replySupportTicket', authed.uid, 60, 10 * 60);

    const ticketRef = db.collection('tickets').doc(input.ticketId);
    const result = await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(ticketRef);
      if (!snap.exists) throw new HttpsError('not-found', 'Ticket not found.');
      const ticket = (snap.data() ?? {}) as Record<string, any>;
      if (ticket.status === 'resolved') throw new HttpsError('failed-precondition', 'Ticket is already resolved.');

      const replies: unknown[] = Array.isArray(ticket.replies) ? ticket.replies : [];
      tx.update(ticketRef, {
        replies: [...replies, {
          by: authed.uid,
          as: 'admin',
          text: input.reply,
          at: new Date().toISOString(),
        }],
        status: input.setStatus ?? 'waiting',
        updatedAt: serverTs(),
      });
      return String(ticket.uid ?? '');
    });

    if (result) await notify(result, 'system', 'Support replied', input.reply.slice(0, 120));
    await writeAuditLog({
      actorUid: authed.uid,
      actorLabel: 'admin',
      action: 'ticket.replied',
      targetType: 'ticket',
      targetId: input.ticketId,
      detail: { setStatus: input.setStatus ?? 'waiting' },
    });

    return { ticketId: input.ticketId, status: input.setStatus ?? 'waiting' };
  },
);
