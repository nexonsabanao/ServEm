'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/account', label: 'Overview' },
  { href: '/account/profile', label: 'Profile' },
  { href: '/account/settings', label: 'Settings' },
];

/** Section tabs for the account area, styled to sit inside the shared shell. */
export function AccountTabs() {
  const pathname = usePathname();
  if (pathname.startsWith('/account/messages') || pathname.startsWith('/account/requests')) {
    return null;
  }

  return (
    <nav className="account-tabs" aria-label="Account sections">
      {TABS.map((tab) => {
        const active = tab.href === '/account'
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link key={tab.href} href={tab.href} className={`account-tab ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
