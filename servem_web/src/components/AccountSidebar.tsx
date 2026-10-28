import { Link, NavLink } from 'react-router-dom';
import { useApp } from '../state/AppState';
import { Avatar } from './ui';

const links = [
  { to: '/app/profile/info', label: 'Personal information' },
  { to: '/app/profile/places', label: 'Addresses' },
  { to: '/app/bookings', label: 'Payments' },
  { to: '/app/notifications', label: 'Notifications' },
  { to: '/app/settings', label: 'Settings' },
  { to: '/app/help', label: 'Help & support' },
];

export function AccountSidebar() {
  const { profile } = useApp();
  return (
    <aside className="w-[190px] shrink-0 max-lg:w-full">
      <div className="card px-5 py-5">
        <Avatar src={profile.photo} name={profile.name} size={52} />
        <p className="mt-3 text-[16px] font-semibold tracking-[-0.01em]">{profile.name}</p>
        <p className="mt-0.5 truncate text-[11.5px] text-[var(--color-muted)]">{profile.email}</p>
        <p className="mt-3 text-[12px] text-[var(--color-muted)]">Customer mode</p>
        <nav className="mt-1 flex flex-col gap-1.5" aria-label="Account">
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center justify-between text-[12.5px] ${
                  isActive ? 'text-[var(--color-ink)]' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                }`
              }
            >
              {item.label}
              <span aria-hidden className="text-[11px] text-[var(--color-muted-2)]">
                →
              </span>
            </NavLink>
          ))}
          <Link to="/mate" className="mt-1 text-[12.5px] text-[var(--color-muted)] hover:text-[var(--color-ink)]">
            Switch to ServMate
          </Link>
        </nav>
      </div>
    </aside>
  );
}
