/**
 * Reject cross-site calls to state-changing routes. Browsers always send an
 * Origin header on POST, so comparing it with the Host blocks a form or fetch
 * driven from another site. Requests without an Origin (curl, health checks)
 * are allowed through.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const host = request.headers.get('host');
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function jsonResponse(
  body: Record<string, unknown>,
  status: number,
): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export const FORBIDDEN_CROSS_SITE = {
  message: 'That request came from another site and was blocked.',
} as const;

export const MALFORMED_BODY = {
  message: 'Send a JSON object as the request body.',
} as const;
