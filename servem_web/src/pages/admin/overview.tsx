import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AdminCard, AdminCollectionState, AdminPage, AdminStats, BarChart } from '../../components/AdminUI';
import { formatPhilippinePeso } from '../../lib/localization';
import { useAdminCollection } from '../../lib/useAdminCollection';
import type { Booking, Dispute, Ticket, VerificationRequest } from '../../lib/types';

/** Last 7 ISO dates (Asia/Manila) oldest first. */
function lastSevenDays(): string[] {
  const days: string[] = [];
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', dateStyle: 'short' });
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date();
    day.setDate(day.getDate() - offset);
    days.push(formatter.format(day));
  }
  return days;
}

const shortDay = (iso: string) => iso.slice(8);

export function AdminOverviewPage() {
  const bookings = useAdminCollection<Booking>('bookings');
  const disputes = useAdminCollection<Dispute>('disputes');
  const tickets = useAdminCollection<Ticket>('tickets');
  const verifications = useAdminCollection<VerificationRequest>('verifications');

  const stats = useMemo(() => {
    const rows = bookings.rows;
    const completed = rows.filter((b) => b.status === 'completed');
    const cancelled = rows.filter((b) => b.status === 'cancelled');
    const serviceValue = completed.reduce((sum, b) => sum + (b.total - b.fee), 0);
    const feeRevenue = completed.reduce((sum, b) => sum + b.fee, 0);
    const finished = completed.length + cancelled.length;
    return {
      total: rows.length,
      serviceValue,
      feeRevenue,
      completed: completed.length,
      cancelled: cancelled.length,
      open: rows.length - finished,
      completion: finished === 0 ? 0 : Math.round((completed.length / finished) * 100),
    };
  }, [bookings.rows]);

  const dailyVolume = useMemo(() => {
    const days = lastSevenDays();
    const counts = new Map<string, number>(days.map((day) => [day, 0]));
    for (const booking of bookings.rows) {
      const key = booking.createdAt?.slice(0, 10);
      if (key && counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return days.map((day) => ({ label: shortDay(day), value: counts.get(day) ?? 0 }));
  }, [bookings.rows]);

  return (
    <AdminPage
      title="Overview"
      subtitle="Aggregated from the live bookings, disputes, tickets and verification queues"
    >
      <AdminCollectionState collection={bookings}>
        {() => (
          <>
            <AdminStats
              items={[
                { label: 'Bookings', value: String(stats.total), note: 'All time in the bookings collection' },
                { label: 'Service value', value: formatPhilippinePeso(stats.serviceValue), note: 'Completed jobs, fees excluded' },
                { label: 'Service fee revenue', value: formatPhilippinePeso(stats.feeRevenue), note: 'Server-calculated per booking' },
                {
                  label: 'Completion rate',
                  value: `${stats.completion}%`,
                  note: `${stats.completed} complete · ${stats.cancelled} cancelled · ${stats.open} open`,
                },
              ]}
            />

            <div className="mt-4 grid grid-cols-2 gap-4 max-lg:grid-cols-1">
              <AdminCard title="Booking volume">
                <p className="text-[11px] text-[var(--color-muted)]">Last 7 days · counted from booking records</p>
                <BarChart data={dailyVolume} />
              </AdminCard>
              <AdminCard title="Queues">
                <div className="mt-3 space-y-3 text-[12.5px]">
                  <p>
                    {disputes.loading ? 'Loading disputes…' : `${disputes.rows.length} open disputes`} ·{' '}
                    <Link to="/admin/disputes" className="link">
                      Disputes →
                    </Link>
                  </p>
                  <p>
                    {verifications.loading
                      ? 'Loading verifications…'
                      : `${verifications.rows.filter((v) => v.status === 'pending').length} verifications waiting`} ·{' '}
                    <Link to="/admin/verification" className="link">
                      Verification queue →
                    </Link>
                  </p>
                  <p>
                    {tickets.loading ? 'Loading tickets…' : `${tickets.rows.length} support tickets`} ·{' '}
                    <Link to="/admin/tickets" className="link">
                      Support →
                    </Link>
                  </p>
                  <p>
                    {bookings.rows.filter((b) => b.status === 'requested').length} requests not yet accepted ·{' '}
                    <Link to="/admin/bookings" className="link">
                      Bookings →
                    </Link>
                  </p>
                </div>
              </AdminCard>
            </div>

            <AdminCard title="Reading this page" className="mt-4">
              <p className="text-[12px] leading-[1.7] text-[var(--color-muted)]">
                Every figure above is computed in the browser from documents returned by Firestore, so it changes as soon
                as the underlying records change. When a queue is empty the number is zero rather than a placeholder.
              </p>
            </AdminCard>
          </>
        )}
      </AdminCollectionState>
    </AdminPage>
  );
}
