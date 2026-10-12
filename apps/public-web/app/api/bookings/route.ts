import { getSessionAccount } from '@/lib/auth';
import { createBooking, listBookings } from '@/lib/bookings';
import { getCatalog } from '@/lib/catalog-source';
import {
  FORBIDDEN_CROSS_SITE,
  MALFORMED_BODY,
  isSameOrigin,
  jsonResponse,
  readJsonBody,
} from '@/lib/http';
import { readString, validateMessage } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function GET() {
  const account = await getSessionAccount();
  if (!account) return jsonResponse({ message: 'Sign in to see your requests.' }, 401);

  const bookings = await listBookings(account.id);
  return jsonResponse({ bookings }, 200);
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  const account = await getSessionAccount();
  if (!account) {
    return jsonResponse({ message: 'Sign in to send a booking request.' }, 401);
  }

  const body = await readJsonBody(request);
  if (!body) return jsonResponse(MALFORMED_BODY, 400);

  const serviceId = readString(body.serviceId);
  const message = readString(body.message);

  const messageError = validateMessage(message);
  if (messageError) {
    return jsonResponse(
      { message: 'Check the highlighted fields.', errors: { message: messageError } },
      400,
    );
  }

  const catalog = await getCatalog();
  const service = catalog.items.find((item) => item.id === serviceId);
  if (!service) {
    return jsonResponse(
      {
        message: 'That service is not in the current catalog. Refresh and try again.',
        errors: { serviceId: 'That service is not in the current catalog.' },
      },
      404,
    );
  }

  const booking = await createBooking({
    userId: account.id,
    serviceId: service.id,
    serviceTitle: service.title,
    ...(service.area ? { area: service.area } : {}),
    message,
  });

  return jsonResponse({ booking }, 201);
}
