import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AdminCard,
  AdminCollectionState,
  AdminEmpty,
  AdminPage,
  AdminStats,
  AdminTable,
  Checkbox,
  ContextCard,
  FilterRow,
  LineChart,
  PaginationFooter,
  RailActions,
} from '../../components/AdminUI';
import { Button, Chip, TextArea, TextInput } from '../../components/ui';
import { formatPhilippinePeso } from '../../lib/localization';
import { sanitizeUserText } from '../../lib/security';
import { useAdminCollection } from '../../lib/useAdminCollection';
import type { Booking } from '../../lib/types';

interface Campaign {
  id: string;
  name: string;
  audience: string;
  status: 'draft' | 'scheduled' | 'sent';
  schedule: string;
  sent: number;
}

const campaignTone = (status: string) => (status === 'sent' ? 'brand' : status === 'scheduled' ? 'info' : 'neutral');

export function AdminAnalyticsPage() {
  const bookings = useAdminCollection<Booking>('bookings');

  const view = useMemo(() => {
    const rows = bookings.rows;
    const completed = rows.filter((b) => b.status === 'completed');
    const cancelled = rows.filter((b) => b.status === 'cancelled');
    const revenue = completed.reduce((sum, b) => sum + (b.total - b.fee), 0);

    const perService = new Map<string, number>();
    for (const booking of rows) {
      perService.set(booking.service, (perService.get(booking.service) ?? 0) + 1);
    }
    const top = [...perService.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topMax = top[0]?.[1] ?? 1;

    const byDay = new Map<string, number>();
    for (const booking of rows) {
      const key = booking.createdAt?.slice(0, 10);
      if (key) byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    const days = [...byDay.keys()].sort();
    const points = days.map((day) => byDay.get(day) ?? 0);
    const labels = days.map((day) => day.slice(5));

    const customers = new Set(rows.map((b) => b.customerId));

    return {
      total: rows.length,
      revenue,
      completed: completed.length,
      cancelled: cancelled.length,
      repeat: customers.size === 0 ? 0 : Math.round((rows.length / customers.size) * 10) / 10,
      top,
      topMax,
      points,
      labels,
    };
  }, [bookings.rows]);

  return (
    <AdminPage title="Analytics" subtitle="Computed from the live bookings collection">
      <FilterRow items={['Compare: previous period', 'Market: Philippines']} />
      <AdminCollectionState collection={bookings}>
        {() => (
          <>
            <AdminStats
              items={[
                { label: 'Bookings', value: String(view.total), note: 'All time' },
                { label: 'Completed value', value: formatPhilippinePeso(view.revenue), note: 'Provider earnings, fees excluded' },
                { label: 'Bookings per customer', value: String(view.repeat), note: 'Repeat indicator' },
                {
                  label: 'Completion',
                  value: `${view.completed} / ${view.completed + view.cancelled}`,
                  note: `${view.cancelled} cancelled`,
                },
              ]}
            />

            <div className="mt-4 grid grid-cols-[1.5fr_1fr] gap-4 max-lg:grid-cols-1">
              <AdminCard title="Bookings per day">
                <p className="text-[11px] text-[var(--color-muted)]">
                  {view.points.length} days with booking activity
                </p>
                <LineChart points={view.points} labels={view.labels} />
              </AdminCard>
              <AdminCard title="Top services by bookings">
                {view.top.length === 0 ? (
                  <p className="mt-2 text-[12px] text-[var(--color-muted)]">Walang bookings to rank yet.</p>
                ) : (
                  <div className="mt-2 space-y-3 text-[12px]">
                    {view.top.map(([name, count]) => (
                      <div key={name}>
                        <p className="flex justify-between">
                          <span>{name}</span>
                          <span className="text-[var(--color-muted)]">
                            {count} · {Math.round((count / view.total) * 100)}%
                          </span>
                        </p>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-[#eef3f0]">
                          <div
                            className="h-full rounded-full bg-[var(--color-bar)]"
                            style={{ width: `${(count / view.topMax) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </AdminCard>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 max-lg:grid-cols-1">
              <ContextCard title="How these numbers are made">
                Every figure is summed in the browser from booking documents returned by Firestore. There is no
                separate analytics store, so large date ranges will get slow before they get wrong.
              </ContextCard>
              <ContextCard title="Cancellations">
                <p>{view.cancelled} cancelled bookings all time.</p>
                <p className="mt-1">
                  Dispute and refund counts live on their own pages:{' '}
                  <Link to="/admin/disputes" className="link">
                    disputes
                  </Link>{' '}
                  and{' '}
                  <Link to="/admin/payments" className="link">
                    payments
                  </Link>
                  .
                </p>
              </ContextCard>
            </div>
          </>
        )}
      </AdminCollectionState>
    </AdminPage>
  );
}

export function AdminCommunicationsPage() {
  const campaigns = useAdminCollection<Campaign>('campaigns');
  return (
    <AdminPage title="Communications" subtitle="Campaign records from the campaigns collection">
      <FilterRow items={['Audience: All', 'State: All', 'Channel: In-app · Email']} />
      <AdminCollectionState
        collection={campaigns}
        empty={
          <AdminEmpty
            title="Walang campaigns yet"
            body="No campaign documents exist yet. Create one from the campaign editor once the messaging service is connected."
          />
        }
      >
        {(rows) => (
          <AdminTable
            headers={['Campaign', 'Audience', 'State', 'Schedule', 'Recipients']}
            footer={<PaginationFooter total={rows.length} />}
          >
            {rows.map((campaign) => (
              <tr key={campaign.id}>
                <td>
                  <Checkbox />
                </td>
                <td className="font-medium text-[var(--color-ink)]">{campaign.name}</td>
                <td>{campaign.audience}</td>
                <td>
                  <Chip small tone={campaignTone(campaign.status)} className="capitalize">
                    {campaign.status}
                  </Chip>
                </td>
                <td className="text-[var(--color-muted)]">{campaign.schedule}</td>
                <td>{campaign.sent}</td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminCollectionState>
      <div className="mt-4">
        <Link to="/admin/campaigns/new" className="btn btn-primary h-[38px] rounded-[8px] px-4 text-[12.5px]">
          New campaign
        </Link>
      </div>
    </AdminPage>
  );
}

export function AdminCampaignEditorPage() {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  return (
    <AdminPage
      title="Campaign editor"
      subtitle="Draft copy only — ServEm does not send campaigns yet"
      actions={<Chip small tone="neutral">Draft</Chip>}
    >
      <div className="mt-4 flex gap-4 max-lg:flex-col">
        <div className="min-w-0 flex-1">
          <section className="card p-5">
            <h2 className="text-[14px] font-semibold">Campaign details</h2>
            <div className="mt-3 space-y-3">
              <TextInput
                label="Internal name"
                value={name}
                onChange={(event) => setName(sanitizeUserText(event.target.value, 80))}
                placeholder="Neighborhood reminder"
              />
              <TextInput
                label="Subject line"
                value={subject}
                onChange={(event) => setSubject(sanitizeUserText(event.target.value, 120))}
                placeholder="A helping hand for your saved services"
              />
              <TextArea
                label="Message"
                rows={5}
                value={message}
                onChange={(event) => setMessage(sanitizeUserText(event.target.value, 500))}
                placeholder="Write the copy reviewers will approve."
              />
            </div>
          </section>

          <ContextCard title="Compliance">
            Before any campaign can be scheduled it needs an unsubscribe link, a named owner and an approved audience
            list. Recipient addresses are not stored in this screen.
          </ContextCard>
        </div>

        <RailActions title="Preview">
          <div className="rounded-[8px] border border-[var(--color-line)] p-3">
            <p className="text-[9px] uppercase tracking-[0.08em] text-[var(--color-muted)]">ServEm</p>
            <p className="mt-1 text-[12px] font-medium">{subject || 'Subject line preview'}</p>
            <p className="mt-1 text-[10.5px] leading-[1.5] text-[var(--color-muted)]">
              {message ? `${message.slice(0, 120)}${message.length > 120 ? '…' : ''}` : 'Message preview appears here.'}
            </p>
            <p className="mt-2 text-[9px] text-[var(--color-brand)]">Unsubscribe link required before sending</p>
          </div>
          <Link to="/admin/communications" className="btn btn-outline h-[36px] w-full text-[12px]">
            Back to campaigns
          </Link>
          <Button small block disabled>
            Scheduling unavailable
          </Button>
          <p className="text-[10.5px] leading-[1.6] text-[var(--color-muted-2)]">
            Saving a campaign needs the messaging service, which is not connected yet. Nothing you type here is sent to
            anybody.
          </p>
        </RailActions>
      </div>
    </AdminPage>
  );
}
