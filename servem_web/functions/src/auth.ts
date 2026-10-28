/**
 * Auth lifecycle trigger.
 *
 * `onAuthUserCreate` provisions the minimal profile document. Firebase Auth
 * user-creation triggers are only offered through the 1st-gen trigger API;
 * everything else in this codebase is v2. The v1 trigger is namespaced to the
 * same region and remains the documented way to react to account creation.
 *
 * Security posture:
 *  - The profile is written with the Admin SDK (bypasses rules); clients can
 *    only patch a small allow-list of display fields per Firestore rules.
 *  - role is hard-coded 'customer'. No privileged fields (admin, verified,
 *    payoutStatus, …) are ever created from auth-claim-adjacent input.
 *  - Idempotent: never overwrites an existing profile.
 */
import type { Transaction } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions/v1';
import { db, serverTs } from './lib/firestore';
import { REGION } from './lib/params';
import { idSchema } from './lib/validate';

export const onAuthUserCreate = functions
  .region(REGION)
  .auth.user()
  .onCreate(async (user: {
    uid: string;
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
    phoneNumber?: string | null;
  }) => {
    let uid = user.uid;
    try {
      uid = idSchema.parse(uid);
    } catch {
      // A uid we would not accept anywhere else must not become a document id.
      console.error('[onAuthUserCreate] refusing non-conforming uid shape');
      return;
    }

    const ref = db.collection('profiles').doc(uid);
    await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(ref);
      if (snap.exists) return; // idempotent — never clobber an existing profile
      tx.set(ref, {
        uid,
        email: typeof user.email === 'string' ? user.email : '',
        name: typeof user.displayName === 'string' ? user.displayName.slice(0, 80) : '',
        phone: typeof user.phoneNumber === 'string' ? user.phoneNumber : '',
        photo: typeof user.photoURL === 'string' ? user.photoURL.slice(0, 500) : '',
        city: '',
        role: 'customer',
        verified: false,
        createdAt: serverTs(),
        updatedAt: serverTs(),
      });
    });
  });
