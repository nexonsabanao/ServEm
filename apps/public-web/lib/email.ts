/**
 * Transactional email.
 *
 * The only message ServEm sends is a password recovery link, so this module is
 * shaped around that: one function, one template, and an explicit
 * `not_configured` result instead of an exception.
 *
 * Resend is used through its REST API rather than its SDK. The project has no
 * runtime dependencies beyond Next and React, and one `fetch` call does not
 * justify adding one — the request shape is the whole integration.
 *
 * When `RESEND_API_KEY` is absent the feature is *disabled*, not broken, which
 * matches how the social providers behave: the caller is told the channel is not
 * configured and the reset page says so, rather than a user waiting for a mail
 * that was never queued.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const FROM_FALLBACK = 'ServEm <onboarding@resend.dev>';

/** How long a send may take before it is treated as failed. */
const SEND_TIMEOUT_MS = 10_000;

export type EmailResult =
  | { ok: true; id?: string }
  | { ok: false; error: 'not_configured' | 'send_failed' };

/** Whether a delivery channel is configured on this server. */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * The mail the recipient sees.
 *
 * Plain text only, and deliberately without the account's name: a recovery mail
 * is sent to an address, and including a name would confirm to whoever reads the
 * mailbox that the account exists. The link carries the token and nothing else.
 */
export function passwordResetEmail(link: string, expiresMinutes: number) {
  return {
    subject: 'Reset your ServEm password',
    text: [
      'Someone asked to reset the password for this ServEm account.',
      '',
      `Open this link to choose a new password (it works once, and expires in ${expiresMinutes} minutes):`,
      link,
      '',
      'If you did not ask for this, you can ignore this email — your password has not changed.',
    ].join('\n'),
  };
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: 'not_configured' };

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? FROM_FALLBACK,
        to: input.to,
        subject: input.subject,
        text: input.text,
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });

    if (!response.ok) return { ok: false, error: 'send_failed' };

    const payload: unknown = await response.json().catch(() => null);
    const id =
      payload && typeof payload === 'object' && typeof (payload as { id?: unknown }).id === 'string'
        ? (payload as { id: string }).id
        : undefined;
    return id ? { ok: true, id } : { ok: true };
  } catch {
    // A refused or timed-out send must not be reported as delivered, and the
    // reason must not reach the caller: the recovery endpoint answers the same
    // way whether an address exists, has no account, or has a broken mailbox.
    return { ok: false, error: 'send_failed' };
  }
}
