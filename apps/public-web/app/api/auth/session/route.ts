import { getSessionAccount } from '@/lib/auth';
import { jsonResponse } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  const account = await getSessionAccount();
  return jsonResponse({ account }, 200);
}
