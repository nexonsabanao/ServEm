import { cookies } from 'next/headers';
import { endSession, SESSION_COOKIE } from '@/lib/auth';
import { FORBIDDEN_CROSS_SITE, isSameOrigin, jsonResponse } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await endSession(token);
  store.delete(SESSION_COOKIE);

  return jsonResponse({ ok: true }, 200);
}
