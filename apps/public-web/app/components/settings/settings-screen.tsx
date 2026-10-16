import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';
import { ChevronRightIcon } from '@/app/components/icons';

/**
 * A settings sub-screen.
 *
 * Every screen under Settings opens the same way — one way back to the list, one
 * heading, and then the controls — so drilling in and backing out is a single
 * gesture you learn once. The heading is the page's `h1`: the shell no longer
 * prints your name on top of every screen, so the page has to name itself.
 */
export function SettingsScreen({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <div className="screen">
      <Link className="screen-back" href="/account/settings">
        <ChevronRightIcon /> Settings
      </Link>
      <div>
        <h1 className="screen-title">{title}</h1>
        {sub && <p className="screen-sub">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

/**
 * One navigable row: an icon, what it is, what it is currently set to, and a
 * chevron. The value is the point — a list of settings should tell you what your
 * settings *are*, so you only open the ones you mean to change.
 */
export function SettingsRow({
  href,
  label,
  value,
  icon: Icon,
}: {
  href: string;
  label: string;
  value?: string;
  icon: ComponentType;
}) {
  return (
    <li>
      <Link className="row" href={href}>
        <span className="row-icon" aria-hidden="true"><Icon /></span>
        <span className="row-copy">
          <span className="row-title">{label}</span>
          {value && <span className="row-value">{value}</span>}
        </span>
        <span className="row-chevron" aria-hidden="true"><ChevronRightIcon /></span>
      </Link>
    </li>
  );
}

/** A titled group of rows. */
export function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="account-section" aria-label={title}>
      <div className="account-section-head">
        <h2>{title}</h2>
      </div>
      <ul className="row-list">{children}</ul>
    </section>
  );
}
