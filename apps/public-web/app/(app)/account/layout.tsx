import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'My account — ServEm',
};

/**
 * The account area's title, and nothing else.
 *
 * The frame, the session read and the request count live one level up, in
 * `app/(app)/layout.tsx`, which wraps every signed-in screen. This layout stays
 * only because the screens under it — requests, profile, one job — set no title
 * of their own and would otherwise fall back to the site's.
 */
export default function AccountLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <>{children}</>;
}
