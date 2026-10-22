import { Storefront } from '@/app/components/feed/storefront';
import { getSessionAccount, getSessionPreferences } from '@/lib/auth';
import { listBookings, summariseBookings } from '@/lib/bookings';
import { authErrorNotice, signedInNotice } from '@/lib/oauth-messages';
import { listFeedServices } from '@/lib/servmate-profile';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{
  q?: string | string[];
  auth?: string | string[];
  auth_error?: string | string[];
  service?: string | string[];
  signin?: string | string[];
  deleted?: string | string[];
}>;

/**
 * The public home — the same shell feed the signed-in `/home` renders, served
 * to everyone.
 *
 * This URL is the app's landing pad: every gated page bounces a signed-out
 * visitor to `/?signin=1`, and the OAuth failure routes land on `/?auth_error=…`.
 * So it renders without a session (a redirect to `/home` would loop straight
 * back through that guard and drop the message) and hands the intent to the
 * storefront wrapper, which opens the sign-in dialog. `?q` filters the feed
 * inline, exactly as the old storefront's search form did, and `?service=` opens
 * that listing's booking sheet. Signing in still ends in a full navigation to
 * `/home`, so the blueprint's customer path is unchanged.
 */
export default async function StorefrontPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = firstValue(params.q).slice(0, 80);
  const service = firstValue(params.service).slice(0, 80);

  const [account, preferences, listings] = await Promise.all([
    getSessionAccount(),
    getSessionPreferences(),
    listFeedServices(),
  ]);
  const bookings = account ? await listBookings(account.id) : [];

  return (
    <Storefront
      account={account ? { name: account.name } : null}
      requestCount={summariseBookings(bookings).total}
      listings={listings}
      initialQuery={q}
      initialArea={preferences.defaultArea}
      initialSort={preferences.defaultSort}
      initialService={service}
      notice={
        deletionNotice(firstValue(params.deleted)) ||
        signedInNotice(firstValue(params.auth)) ||
        authErrorNotice(firstValue(params.auth_error))
      }
      signInIntent={firstValue(params.signin) === '1'}
    />
  );
}

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

/**
 * The one line shown after an account is deleted.
 *
 * It says what happened and that something was kept *before* the person has to
 * wonder, without dressing deletion up as a happy ending or hiding the retained
 * record the other side of a finished booking still holds.
 */
function deletionNotice(value: string): string {
  return value === '1'
    ? 'Your account and its data were deleted. Finished bookings stay with the other person for a short retention window, then they go too.'
    : '';
}
