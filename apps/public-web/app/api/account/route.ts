import { cookies } from 'next/headers';
import { deleteAccount, deletionPreview } from '@/lib/account-deletion';
import { getSessionAccount, SESSION_COOKIE } from '@/lib/auth';
import {
  FORBIDDEN_CROSS_SITE,
  isSameOrigin,
  jsonResponse,
  MALFORMED_BODY,
  readJsonBody,
} from '@/lib/http';
import { consume, tooManyResponse } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * What deleting this account would do — the same answer the settings screen
 * renders, offered as JSON for a caller that wants to check before acting.
 *
 * Scoped to the session: there is no id in the path, so one account cannot ask
 * about another's obligations.
 */
export async function GET() {
  const account = await getSessionAccount();
  if (!account) return jsonResponse({ message: 'Sign in to manage your account.' }, 401);

  const preview = await deletionPreview(account.id);
  if (!preview) return jsonResponse({ message: 'That account no longer exists.' }, 404);

  return jsonResponse({ ...preview }, 200);
}

/**
 * Deletes the signed-in account.
 *
 * Three things are required and each is deliberate:
 *
 *  - the JSON body must carry the literal phrase `DELETE`, so a stray request or
 *    a mis-wired button cannot destroy an account;
 *  - the current password must be supplied when the account has one, so a stolen
 *    session cookie alone cannot erase somebody's history;
 *  - no live booking or open job may exist, so the other party is never stranded.
 *
 * On success every session is ended and this browser's cookie is cleared, so the
 * response cannot leave the caller holding a live credential for a tombstone.
 */
export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  const account = await getSessionAccount();
  if (!account) return jsonResponse({ message: 'Sign in to delete your account.' }, 401);

  // This route checks the password, so it counts attempts exactly as sign-in
  // does — the ceiling is per account, not per address, because the account is
  // what is at stake.
  const quota = consume('accountDelete', account.id);
  if (!quota.ok) return tooManyResponse(quota.retryAfterSeconds);

  const body = await readJsonBody(request);
  if (!body) return jsonResponse(MALFORMED_BODY, 400);

  if (body.confirmation !== 'DELETE') {
    return jsonResponse(
      { message: 'Type DELETE to confirm you want this account removed.' },
      400,
    );
  }

  // Expiry belongs to the retention clock (`lib/purge-scheduler`), not to this
  // request: deleting an account does its own work in one transaction and no
  // longer pays for unrelated tombstones first.
  const password = typeof body.password === 'string' ? body.password : null;
  const result = await deleteAccount(account.id, password);

  if (!result.ok) {
    if (result.error === 'active_obligations') {
      return jsonResponse(
        {
          message:
            'Finish or cancel that work before deleting your account. The other person is part of it.',
          blockers: result.blockers,
        },
        409,
      );
    }
    if (result.error === 'wrong_password') {
      return jsonResponse({ message: 'That password is not right.' }, 403);
    }
    return jsonResponse({ message: 'That account no longer exists.' }, 404);
  }

  const store = await cookies();
  store.delete(SESSION_COOKIE);

  return jsonResponse(
    {
      ok: true,
      purgeAfter: result.purgeAfter,
      retainedBookings: result.retainedBookings,
    },
    200,
  );
}
