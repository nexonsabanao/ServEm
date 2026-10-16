import { ResetForm } from '@/app/components/reset-form';
import { resetTokenIsLive } from '@/lib/password-reset';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Reset your password — ServEm',
  description: 'Choose a new password for your ServEm account.',
};

type SearchParams = Promise<{ token?: string | string[] }>;

/**
 * Password recovery, in one page with two states.
 *
 * Without a token the page asks for the account's address. With one it checks
 * that the link is still live *before* rendering the password box, so nobody
 * types a new password into a form that cannot possibly work — the expiry is
 * shown instead. The check is a courtesy: redeeming the token is the only thing
 * that changes a password, and the server refuses an unknown, spent or expired
 * link with the same reply either way.
 */
export default async function ResetPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const token = readToken(params.token);
  const live = token ? await resetTokenIsLive(token) : false;

  return (
    <main className="reset-page">
      {/*
        The state is rendered here, on the server, rather than left to the form:
        it is what decides which of the three states a visitor is in, it must be
        right before the first paint, and it gives tests something to assert that
        is not a string inside the client bundle.
      */}
      <section
        className="reset-card"
        aria-labelledby="reset-title"
        data-state={token ? (live ? 'choose' : 'expired') : 'request'}
      >
        <p className="dialog-kicker">PASSWORD RECOVERY</p>
        <h1 id="reset-title">{token ? 'Choose a new password' : 'Reset your password'}</h1>
        <p className="auth-lede">
          {token
            ? 'This link works once. Changing the password ends every session on this account.'
            : 'Tell us which address you signed up with and we will send a link that works for one hour.'}
        </p>
        <ResetForm token={token} live={live} />
      </section>
    </main>
  );
}

/**
 * Accepts the token only in the shape this server issues: 64 hex characters.
 * Anything else is treated as an absent token rather than hashed and looked up,
 * which keeps junk query strings from reaching the store.
 */
function readToken(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] ?? '' : value ?? '';
  const token = raw.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(token) ? token : null;
}
