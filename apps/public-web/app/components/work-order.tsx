import type { ReactNode } from 'react';
import { formatDay, formatDayShort, formatRate, formatTimeOfDay } from '@/lib/format';
import type { Booking } from '@/lib/bookings';

/**
 * The work docket is this product's own object, so the account area is built
 * out of it: a full docket for the job in hand, and ledger rows for the rest.
 * Everything here renders real records — no placeholder rows.
 */

export const STATUS_LABELS: Record<Booking['status'], string> = {
  requested: 'Requested',
  cancelled: 'Withdrawn',
};

export function StatusStamp({ status }: { status: Booking['status'] }) {
  return (
    <span className="status-stamp" data-status={status}>
      <span className="status-dot" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}

type DocketProps = {
  booking: Booking | null;
  /** The published rate for the booked service, when the catalog still has it. */
  rateCentavos?: number;
};

/** The single open job, shown as the record it is. */
export function WorkDocket({ booking, rateCentavos }: DocketProps) {
  if (!booking) {
    return (
      <div className="docket docket-empty">
        <div className="docket-head">
          <span className="docket-brand">ServEm</span>
          <span className="docket-kind">No work order open</span>
        </div>
        <p className="docket-empty-copy">
          Nothing is booked right now. Pick a service and send a request — you only pay
          once the job is done.
        </p>
        <a className="button button-primary" href="/home">
          Browse local services
        </a>
      </div>
    );
  }

  return (
    <article className="docket" aria-label={`Work order ${booking.reference}`}>
      <span className="docket-perforation" aria-hidden="true" />
      <div className="docket-head">
        <span className="docket-brand">ServEm</span>
        <span className="docket-kind">
          Work order<span className="docket-no">{booking.reference}</span>
        </span>
      </div>

      <div className="docket-flags">
        {booking.area && <span className="docket-tag">{booking.area}</span>}
        <StatusStamp status={booking.status} />
      </div>

      <h3 className="docket-title">{booking.serviceTitle}</h3>

      <dl className="docket-ledger">
        <div>
          <dt>Requested</dt>
          <span className="docket-leader" aria-hidden="true" />
          <dd>
            {formatDay(booking.createdAt)} · {formatTimeOfDay(booking.createdAt)}
          </dd>
        </div>
        <div>
          <dt>Where</dt>
          <span className="docket-leader" aria-hidden="true" />
          <dd>{booking.area ?? 'At your address'}</dd>
        </div>
        <div>
          <dt>Rate</dt>
          <span className="docket-leader" aria-hidden="true" />
          <dd>{rateCentavos === undefined ? 'Quoted after details' : formatRate(rateCentavos)}</dd>
        </div>
      </dl>

      <div className="docket-brief">
        <span className="docket-label">Your brief</span>
        <p>{booking.message}</p>
      </div>

      <div className="docket-total">
        <span>Due after the visit</span>
        <strong>{rateCentavos === undefined ? '—' : formatRate(rateCentavos).replace('From ', '')}</strong>
      </div>
    </article>
  );
}

type RowProps = {
  booking: Booking;
  action?: ReactNode;
};

export function WorkOrderRow({ booking, action }: RowProps) {
  return (
    <li className="order-row" data-status={booking.status}>
      <div className="order-when">
        <strong>{formatDayShort(booking.createdAt)}</strong>
        <span>{formatTimeOfDay(booking.createdAt)}</span>
      </div>
      <div className="order-what">
        <span className="order-ref">{booking.reference}</span>
        <h3>{booking.serviceTitle}</h3>
        <p className="order-brief">{booking.message}</p>
        {booking.area && <span className="order-area">{booking.area}</span>}
      </div>
      <div className="order-state">
        <StatusStamp status={booking.status} />
      </div>
      <div className="order-actions">{action}</div>
    </li>
  );
}
