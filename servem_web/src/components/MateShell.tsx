import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from './ui';
import { useApp } from '../state/AppState';

const groups: { items: { to: string; label: string }[] }[] = [
  {
    items: [
      { to: '/mate', label: 'Home' },
      { to: '/mate/requests', label: 'Requests' },
      { to: '/mate/jobs', label: 'My Jobs' },
      { to: '/mate/services', label: 'Services' },
      { to: '/mate/hours', label: 'Availability' },
      { to: '/mate/area', label: 'Service area' },
      { to: '/mate/earnings', label: 'Earnings' },
      { to: '/mate/reviews', label: 'Reviews' },
      { to: '/mate/messages', label: 'Messages' },
      { to: '/mate/updates', label: 'Notifications' },
      { to: '/mate/account', label: 'Settings' },
    ],
  },
];

export function MateShell() {
  const { profile } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const place = [profile.city, 'Philippines'].filter(Boolean).join(', ');
  const accountName = profile.name || 'Your account';

  return (
    <div className="min-h-[100dvh] bg-[var(--color-page)]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[224px] flex-col border-r border-[var(--color-line)] bg-white px-6 py-6 lg:flex">
        <Logo />
        <p className="mt-2 text-[12.5px] text-[var(--color-muted)]">ServMate mode</p>

        <nav className="mt-8 flex flex-1 flex-col gap-1.5" aria-label="ServMate workspace">
          {groups[0].items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/mate'}
              className={({ isActive }) =>
                `relative rounded-md py-1.5 pl-4 text-[13px] transition-colors ${
                  isActive
                    ? 'font-medium text-[var(--color-ink)] before:absolute before:left-0 before:top-1/2 before:h-1.5 before:w-1.5 before:-translate-y-1/2 before:rounded-full before:bg-[var(--color-brand)]'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-6 border-t border-[var(--color-line)] pt-4">
          <p className="text-[12.5px] text-[var(--color-muted)]">
            {accountName}
            {place ? ` · ${place}` : ''}
          </p>
          <NavLink to="/app/home" className="mt-2 block text-[12.5px] text-[var(--color-muted)] hover:text-[var(--color-ink)]">
            Switch to customer view
          </NavLink>
        </div>
      </aside>

      <div className="lg:pl-[224px]">
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-line)] bg-white px-5 py-4 lg:hidden">
          <Logo />
          <NavLink to="/app/home" className="ml-auto text-[12.5px] text-[var(--color-muted)]">
            Switch to customer view
          </NavLink>
          <label className="w-full">
            <span className="sr-only">ServMate section</span>
            <select
              className="field h-11 bg-white"
              value={groups[0].items.find((item) => item.to === location.pathname)?.to ?? ''}
              onChange={(event) => navigate(event.target.value)}
            >
              <option value="" disabled>Choose a workspace section</option>
              {groups[0].items.map((item) => <option key={item.to} value={item.to}>{item.label}</option>)}
            </select>
          </label>
        </div>
        <main className="mx-auto max-w-[1000px] px-10 py-10 max-lg:px-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
