/**
 * createReview — only the authenticated customer assigned to a COMPLETED
 * booking may review, exactly once per booking (the review document is keyed
 * by bookingId, so uniqueness is enforced by Firestore itself, not by a
 * racy query). Provider and service ids are copied from the booking server
 * side; the client controls none of them.
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
import { writeAuditLog } from './lib/audit';
import { notify } from './lib/notify';
import { idSchema, parseInput, ratingSchema, sanitizedText } from './lib/validate';

const createReviewSchema = z.object({
  bookingId: idSchema,
  rating: ratingSchema,
  comment: sanitizedText(0, 1000).optional().default(''),
});

export const createReview = onCall(
  { region: REGION, cors: CORS_REGEX, timeoutSeconds: 30, memory: '256MiB' },
  async (req: CallableRequest) => {
    const authed = requireAuth(req);
    const input = parseInput(createReviewSchema, req.data);
    assertSafePathSegment(input.bookingId);
    await enforceRateLimit('createReview', authed.uid, 5, 60 * 60);

    const bookingRef = db.collection('bookings').doc(input.bookingId);
    const reviewRef = db.collection('reviews').doc(input.bookingId);
    const profile = await db.collection('profiles').doc(authed.uid).get();
    const profileData = (profile.data() ?? {}) as Record<string, any>;

    const review = await db.runTransaction(async (tx: Transaction) => {
      const bookingSnap = await tx.get(bookingRef);
      if (!bookingSnap.exists) throw new HttpsError('not-found', 'Booking not found.');
      const booking = (bookingSnap.data() ?? {}) as Record<string, any>;

      if (booking.customerId !== authed.uid) {
        throw new HttpsError('permission-denied', 'Only the customer on this booking can review it.');
      }
      if (booking.status !== 'completed') {
        throw new HttpsError('failed-precondition', 'Reviews are only allowed after the job is completed.');
      }
      const existing = await tx.get(reviewRef);
      if (existing.exists) throw new HttpsError('already-exists', 'This booking already has a review.');

      const data = {
        bookingId: input.bookingId,
        authorId: authed.uid,
        authorName: String(profileData.name ?? profileData.email ?? ''),
        authorPhoto: String(profileData.photo ?? ''),
        // Server-derived — never read from client input:
        providerId: String(booking.providerId ?? ''),
        serviceId: String(booking.serviceId ?? ''),
        service: String(booking.service ?? ''),
        rating: input.rating,
        comment: input.comment,
        flagged: false,
        status: 'published',
        createdAt: serverTs(),
      };
      tx.set(reviewRef, data);
      tx.update(bookingRef, { status: 'reviewed', updatedAt: serverTs() });
      return data;
    });

    if (review.providerId) {
      await notify(review.providerId, 'booking', 'New review received', `${input.rating}/5 stars for ${review.service || 'your service'}.`, input.bookingId);
    }
    await writeAuditLog({
      actorUid: authed.uid,
      actorLabel: 'customer',
      action: 'review.created',
      targetType: 'booking',
      targetId: input.bookingId,
      detail: { rating: input.rating, hasComment: input.comment.length > 0 },
    });

    return { reviewId: reviewRef.id, rating: input.rating };
  },
);
