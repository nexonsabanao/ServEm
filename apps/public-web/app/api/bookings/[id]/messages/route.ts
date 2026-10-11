import { getSessionAccount } from '@/lib/auth';
import { sendCustomerMessage } from '@/lib/conversations';
import {
  FORBIDDEN_CROSS_SITE,
  MALFORMED_BODY,
  isSameOrigin,
  jsonResponse,
  readJsonBody,
} from '@/lib/http';
import { readString, validateChatMessage } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  const account = await getSessionAccount();
  if (!account) return jsonResponse({ message: 'Sign in to message your ServMate.' }, 401);

  const body = await readJsonBody(request);
  if (!body) return jsonResponse(MALFORMED_BODY, 400);

  const message = readString(body.message);
  const validationError = validateChatMessage(message);
  if (validationError) {
    return jsonResponse(
      { message: validationError, errors: { message: validationError } },
      400,
    );
  }

  const { id: bookingId } = await context.params;
  const result = await sendCustomerMessage(account.id, bookingId, message);
  if (!result.ok && result.error === 'not_found') {
    return jsonResponse({ message: 'That conversation could not be found.' }, 404);
  }
  if (!result.ok) {
    return jsonResponse({ message: 'This conversation is closed because the request was withdrawn.' }, 409);
  }

  return jsonResponse({ message: result.message }, 201);
}
