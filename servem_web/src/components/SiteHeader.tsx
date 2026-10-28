import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useApp, useUnreadNotifications } from '../state/AppState';
import { Avatar, Logo } from './ui';

const nav = [
  { to: '/app/home', label: 'Home' },
  { to: '/app/explore', label: 'Explore' },
  { to: '/app/bookings', label: 'Bookings' },
  { to: '/app/messages', label: 'Messages' },
  { to: '/app/saved', label: 'Favorites' },
];

export function SiteHeader() {
  const { profile, user } = useApp();
  const unread = useUnreadNotifications();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  /* Nobody is signed in yet — the visitor came from the legal links on the
     sign-up or log-in screen. The account chrome below (app nav, notification
     bell, profile chip) would read as "someone is logged in", and every link
     in it would only bounce to /login, so offer the way in instead. */
  if (!user) {
    return (
      <header className="site-header">
        <div className="shell-width site-header-inner">
          <Logo to="/" />
          <div className="ml-auto flex items-center gap-4">
            <Link
              to="/login"
              className="text-[14px] text-[var(--color-ink-2)] transition-colors hover:text-[var(--color-brand-deep)]"
            >
              Log in
            </Link>
            <Link to="/signup" className="btn btn-primary btn-pill">
              Get started
            </Link>
          </div>
        </div>
      </header>
    );
  }

  const displayName = profile.name || user.displayName || user.email || 'Account';

  return (
    <header className="site-header">
      <div className="shell-width site-header-inner">
        <Logo to="/app/home" />
        <nav className="site-nav" aria-label="Main">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} className="nav-link">
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Link
            to="/app/notifications"
            className="relative grid h-9 w-9 place-items-center rounded-full text-[var(--color-ink-2)] hover:bg-[var(--color-soft)]"
            aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M10.3 21a2 2 0 0 0 3.4 0" />
            </svg>
            {unread > 0 ? (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--color-brand)]" />
            ) : null}
          </Link>
          <Link to="/app/profile" className="profile-link flex items-center gap-2.5">
            {/* The profile document arrives a beat after the session does:
                fall back to the auth record so the chip never renders blank
                and read as a signed-out account. */}
            <Avatar src={profile.photo || user.photoURL || ''} name={displayName} size={30} />
            <span className="text-[14px] text-[var(--color-ink-2)]">{displayName}</span>
          </Link>
          <button
            type="button"
            className="nav-toggle"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>
      {open ? (
        <nav id="mobile-navigation" className="mobile-nav shell-width" aria-label="Mobile main">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={location.pathname === item.to ? 'mobile-nav-link active' : 'mobile-nav-link'}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

export function AuthHeader() {
  return (
    <header className="site-header">
      <div className="shell-width flex h-[70px] items-center justify-between">
        <div className="flex items-center gap-12">
          <Logo />
          <Link to="/app/help" className="hidden text-[13px] text-[var(--color-brand)] sm:inline">
            Need a hand? Help &amp; support
          </Link>
        </div>
        <p className="hidden text-[13px] text-[var(--color-muted)] sm:block">Local skills. A little peace of mind.</p>
      </div>
    </header>
  );
}
