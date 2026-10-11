import { providerAvailability } from '@/lib/oauth';

export const dynamic = 'force-dynamic';

/**
 * Which OAuth providers this server can actually complete a sign-in with.
 * The browser needs this so it only offers buttons that can work.
 */
export async function GET() {
  return Response.json(providerAvailability(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
