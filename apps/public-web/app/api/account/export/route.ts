import { exportAccountData } from '@/lib/account';
import { getSessionAccount } from '@/lib/auth';
import { jsonResponse } from '@/lib/http';

export const dynamic = 'force-dynamic';

/**
 * Downloads everything the account owns as JSON.
 *
 * The export is scoped to the session's account and assembled from the store,
 * so it contains that person's requests and messages only — no other account's
 * data, and no credential material.
 */
export async function GET() {
  const account = await getSessionAccount();
  if (!account) return jsonResponse({ message: 'Sign in to export your data.' }, 401);

  const data = await exportAccountData(account.id);
  if (!data) return jsonResponse({ message: 'That account no longer exists.' }, 404);

  const stamp = data.exportedAt.slice(0, 10);

  return new Response(`${JSON.stringify(data, null, 2)}\n`, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="servem-account-${stamp}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
