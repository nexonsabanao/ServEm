import { getCatalog } from '@/lib/catalog-source';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const cursor = new URL(request.url).searchParams.get('cursor');
  if (cursor !== null && cursor.length > 512) {
    return Response.json({ message: 'The catalog cursor is invalid.' }, { status: 400 });
  }
  const catalog = await getCatalog(cursor);
  const status = catalog.status === 'unavailable' ? 503 : 200;
  return Response.json(catalog, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
