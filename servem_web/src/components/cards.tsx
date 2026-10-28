import { Link } from 'react-router-dom';
import { Armchair, Briefcase, ChevronRight, Laptop, Sparkles, Sprout, Star, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { Avatar, Chip, LinkButton, Stars } from './ui';
import { PLATFORM_FEE_RATE } from '../lib/localization';
import type { Booking, Review, Service, ServMate } from '../lib/types';

const iconMap = {
  Repairs: Wrench,
  Cleaning: Sparkles,
  Errands: Briefcase,
  Assembly: Armchair,
  'Tech help': Laptop,
  'Yard & garden': Sprout,
};

export function CategoryTile({
  label,
  to,
  active = false,
}: {
  label: string;
  to: string;
  active?: boolean;
}) {
  const Icon = iconMap[label as keyof typeof iconMap] ?? Wrench;
  return (
    <Link
      to={to}
      className={`card flex min-h-[112px] flex-col items-center justify-center gap-3 px-3 transition-colors hover:border-[#c9dbd2] ${
        active ? 'border-[var(--color-brand)] bg-[#fbfefc]' : ''
      }`}
    >
      <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-[var(--color-soft)] text-[var(--color-brand)]">
        <Icon size={18} strokeWidth={1.8} aria-hidden />
      </span>
      <span className="text-[13px] text-[var(--color-ink-2)]">{label}</span>
    </Link>
  );
}

/**
 * A listing photo, or a soft placeholder while the listing has none — an empty
 * `src` makes the browser re-request the whole page.
 */
function ServiceImage({
  image,
  alt,
  className,
}: {
  image: string;
  alt: string;
  className: string;
}) {
  if (!image) return <div className={`${className} bg-[var(--color-soft)]`} aria-hidden />;
  return <img src={image} alt={alt} className={className} loading="lazy" />;
}

export function ServiceCard({ service, className = '' }: { service: Service; className?: string }) {
  return (
    <div className={`card overflow-hidden ${className}`}>
      <Link to={`/app/services/${service.id}`} className="block">
        <ServiceImage image={service.image} alt={service.name} className="h-[232px] w-full object-cover" />
      </Link>
      <div className="flex items-center gap-4 px-4 py-4">
        <ServiceImage image={service.image} alt="" className="h-12 w-12 rounded-[8px] object-cover" />
        <div className="min-w-0 flex-1">
          <Link to={`/app/services/${service.id}`} className="card-title block truncate hover:underline">
            {service.name}
          </Link>
          <p className="mt-0.5 text-[12.5px] text-[var(--color-muted)]">
            {service.provider}
            {service.distance ? ` · ${service.distance}` : ''}
          </p>
          <p className="mt-1.5 text-[15px] font-medium">₱{service.rate} / hr</p>
        </div>
        <span className="flex items-center gap-1 self-end pb-0.5 text-[12.5px] text-[var(--color-ink-2)]">
          {service.rating > 0 ? (
            <>
              <Star size={12} strokeWidth={1.4} fill="currentColor" aria-hidden /> {service.rating}
            </>
          ) : (
            <span className="text-[var(--color-muted)]">New</span>
          )}
        </span>
      </div>
      {service.tags[0] ? (
        <div className="px-4 pb-4">
          <Chip small>{service.tags[0]}</Chip>
        </div>
      ) : null}
    </div>
  );
}

export function ServiceRow({ service }: { service: Service }) {
  return (
    <Link to={`/app/services/${service.id}`} className="card flex items-center gap-4 p-3 hover:border-[#c9dbd2]">
      <ServiceImage image={service.image} alt="" className="h-16 w-16 rounded-[10px] object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14.5px] font-medium">{service.name}</p>
        <p className="mt-0.5 text-[12.5px] text-[var(--color-muted)]">{service.provider}</p>
      </div>
      <div className="text-right">
        <p className="text-[14px] font-medium">₱{service.rate}/hr</p>
        <p className="mt-1 flex items-center justify-end gap-1 text-[12px] text-[var(--color-muted)]">
          <Star size={11} strokeWidth={1.4} fill="currentColor" aria-hidden /> {service.rating}
        </p>
      </div>
      <ChevronRight size={16} className="text-[var(--color-muted-2)]" />
    </Link>
  );
}

export function FeaturedServiceCard({ service }: { service: Service }) {
  return (
    <div className="card p-5">
      <h3 className="text-[17px] font-medium tracking-[-0.01em]">{service.blurb}</h3>
      <Link to={`/app/services/${service.id}`}>
        <ServiceImage image={service.image} alt={service.name} className="mt-4 h-[190px] w-full rounded-[10px] object-cover" />
      </Link>
      <p className="mt-4 text-[12.5px] text-[var(--color-muted)]">
        {service.provider} · {service.tags[0] ?? 'Local help'} ·{' '}
        <span className="inline-flex translate-y-[1px] items-center gap-1">
          <Star size={11} strokeWidth={1.4} fill="currentColor" aria-hidden /> {service.rating}
        </span>
      </p>
      <LinkButton to={`/app/services/${service.id}`} variant="ghost" block className="mt-4">
        From ₱{service.rate} / hr · View service
      </LinkButton>
    </div>
  );
}

export function ProviderCard({ mate, compact = false }: { mate: ServMate; compact?: boolean }) {
  return (
    <Link to={`/app/servmates/${mate.id}`} className="card flex items-start gap-4 p-4 hover:border-[#c9dbd2]">
      <Avatar src={mate.photo} name={mate.name} size={44} />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium">{mate.name}</p>
        <p className="mt-0.5 whitespace-nowrap text-[12px] text-[var(--color-muted)]">
          <Star size={11} strokeWidth={1.4} fill="currentColor" className="inline align-[-1px]" aria-hidden />{' '}
          {mate.rating} · {mate.reviews} reviews · {mate.jobs} jobs
        </p>
        {!compact ? <p className="mt-2 text-[12px] font-medium text-[var(--color-brand)]">View profile</p> : null}
      </div>
      <ChevronRight size={16} className="mt-2 text-[var(--color-muted-2)]" />
    </Link>
  );
}

export function ReviewsPanel({ reviews, className = '' }: { reviews: Review[]; className?: string }) {
  return (
    <div className={`card p-5 ${className}`}>
      <h3 className="card-title">Reviews</h3>
      {reviews.slice(0, 2).map((review) => (
        <div key={review.id} className="mt-3 border-t border-[var(--color-line-2)] pt-3 first:border-0 first:pt-0">
          <p className="text-[12.5px] text-[var(--color-ink-2)]">
            {review.author} · <Stars rating={review.rating} />
          </p>
          <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">“{review.text}”</p>
          <p className="mt-1 text-[11.5px] text-[var(--color-muted-2)]">
            {review.date} · {review.service}
          </p>
        </div>
      ))}
    </div>
  );
}

export function SummaryRail({
  service,
  date,
  time,
  children,
}: {
  service: Service;
  date?: string;
  time?: string;
  children?: ReactNode;
}) {
  return (
    <aside className="flex w-[332px] shrink-0 flex-col gap-4 max-lg:w-full">
      <ProviderCard mate={providerFor(service)} />
      <div className="rail-card">
        <p className="text-[15px] font-medium">₱{service.rate} / hr</p>
        <div className="mt-2 space-y-1 text-[12.5px] text-[var(--color-muted)]">
          <p>{service.minHours}-hour minimum</p>
          {date ? (
            <p>
              {date} · {time}
            </p>
          ) : (
            <p>Next available · {service.availability.split(' · ')[0]}</p>
          )}
          <p>{service.distance ? `Approximate distance ${service.distance}` : 'Distance confirmed after booking'}</p>
          <p className="leading-[1.6]">Service area · {providerFor(service).area}</p>
        </div>
        <LinkButton to={`/app/book/${service.id}/date`} block className="mt-4">
          Book Now
        </LinkButton>
      </div>
      <div className="tip">
        <p className="font-medium text-[#1d4a38]">A little privacy, by design</p>
        <p className="mt-1">Exact addresses and contact details stay private until a booking is accepted.</p>
      </div>
      {children}
    </aside>
  );
}

export function CartSummary({
  service,
  hours,
  date,
  time,
  fee,
}: {
  service: Service;
  hours: number;
  date: string;
  time: string;
  fee?: number;
}) {
  const subtotal = service.rate * hours;
  const bookingFee = fee ?? Math.round(subtotal * PLATFORM_FEE_RATE);
  return (
    <aside className="flex w-[332px] shrink-0 flex-col gap-4 max-lg:w-full">
      <ProviderCard mate={providerFor(service)} />
      <div className="rail-card">
        <p className="text-[14.5px] font-medium">Customer total · ₱{(subtotal + bookingFee).toFixed(2)}</p>
        <div className="mt-2 space-y-1 text-[12.5px] text-[var(--color-muted)]">
          <p>
            {hours} hours × ₱{service.rate} <span className="float-right">₱{subtotal.toFixed(2)}</span>
          </p>
          <p>
            Service fee <span className="float-right">₱{bookingFee.toFixed(2)}</span>
          </p>
          <p className="pt-1 leading-[1.6]">
            Payment is arranged with your ServMate after the job. ServEm never stores your card details.
          </p>
        </div>
      </div>
      <div className="tip">
        <p className="font-medium text-[#1d4a38]">A little privacy, by design</p>
        <p className="mt-1">Only general areas appear until your ServMate accepts. No live location is shared.</p>
      </div>
      <p className="sr-only">
        {date} {time}
      </p>
    </aside>
  );
}

export function BookingCard({ booking }: { booking: Booking }) {
  return (
    <Link
      to={`/app/bookings/${booking.id}`}
      className="card flex items-start justify-between gap-6 p-5 hover:border-[#c9dbd2]"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[14.5px] font-medium">{booking.service}</p>
          <Chip small tone={statusTone(booking.status)}>
            {booking.status.replace('_', ' ')}
          </Chip>
        </div>
        <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">
          {booking.date} · {booking.time} · {booking.hours}h
        </p>
        <p className="mt-2 text-[12.5px] text-[var(--color-muted-2)]">{booking.address}</p>
        <p className="mt-2 text-[11.5px] text-[var(--color-muted-2)]">{booking.id}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <Avatar src={booking.providerPhoto} name={booking.provider} size={32} />
        <span className="text-[12.5px] text-[var(--color-muted)]">₱{booking.total.toFixed(2)}</span>
      </div>
    </Link>
  );
}

function statusTone(status: Booking['status']): 'brand' | 'neutral' | 'warn' | 'info' {
  if (status === 'completed') return 'brand';
  if (status === 'cancelled') return 'neutral';
  if (status === 'confirmed') return 'info';
  return 'warn';
}

function providerFor(service: Service): ServMate {
  return {
    id: service.providerId,
    uid: service.providerId,
    name: service.provider,
    // No photo on the listing yet: Avatar falls back to the provider's initials.
    photo: '',
    rating: service.rating,
    reviews: service.reviews,
    jobs: 0,
    rate: service.rate,
    distance: service.distance,
    area: service.area,
    skills: [service.category],
    availability: service.availability,
    verified: false,
    bio: service.description,
    responseTime: 'Usually replies in 1 hour',
    repeat: 92,
    cover: service.image,
    status: 'active',
  };
}
