import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from './ui';

const nav = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/customers', label: 'Customers' },
  { to: '/admin/servmates', label: 'ServMates' },
  { to: '/admin/verification', label: 'Verification' },
  { to: '/admin/catalog', label: 'Service catalog' },
  { to: '/admin/bookings', label: 'Bookings & jobs' },
  { to: '/admin/payments', label: 'Payments & refunds' },
  { to: '/admin/payouts', label: 'Payouts' },
  { to: '/admin/disputes', label: 'Disputes & safety' },
  { to: '/admin/tickets', label: 'Support tickets' },
  { to: '/admin/reviews', label: 'Reviews' },
  { to: '/admin/analytics', label: 'Analytics' },
  { to: '/admin/communications', label: 'Communications' },
  { to: '/admin/settings', label: 'Platform settings' },
  { to: '/admin/team', label: 'Team & permissions' },
  { to: '/admin/audit', label: 'Audit log' },
];

export function AdminShell() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div className="min-h-[100dvh] bg-[var(--color-page)]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[224px] flex-col border-r border-[var(--color-line)] bg-white px-6 py-6 lg:flex">
        <Logo />
        <p className="mt-2 text-[12.5px] text-[var(--color-muted)]">Operations</p>

        <nav className="mt-8 flex flex-1 flex-col gap-0.5 overflow-y-auto pb-4" aria-label="Admin">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `relative rounded-md py-1.5 pl-4 text-[12.5px] leading-5 transition-colors ${
                  isActive
                    ? 'font-medium text-[var(--color-ink)] before:absolute before:left-0 before:top-1/2 before:h-1.5 before:w-1.5 before:-translate-y-1/2 before:rounded-full before:bg-[var(--color-ink)]'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-[var(--color-line)] pt-4">
          <p className="text-[12.5px] text-[var(--color-muted)]">Morgan Dela Cruz · Admin</p>
          <p className="mt-1 text-[11px] text-[var(--color-muted-2)]">Least-privilege workspace</p>
        </div>
      </aside>

      <div className="lg:pl-[224px]">
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-line)] bg-white px-5 py-4 lg:hidden">
          <Logo />
          <span className="ml-auto text-[12px] text-[var(--color-muted)]">Operations</span>
          <label className="w-full">
            <span className="sr-only">Admin section</span>
            <select
              className="field h-11 bg-white"
              value={nav.find((item) => item.to === location.pathname)?.to ?? ''}
              onChange={(event) => navigate(event.target.value)}
            >
              <option value="" disabled>Choose an admin section</option>
              {nav.map((item) => <option key={item.to} value={item.to}>{item.label}</option>)}
            </select>
          </label>
        </div>
        <main className="mx-auto max-w-[1120px] px-8 py-8 max-lg:px-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
