import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { SiteHeader } from '../../components/SiteHeader';
import {
  Callout,
  Chip,
  FooterNote,
  PageHeader,
  SearchInput,
  SectionHead,
} from '../../components/ui';
import {
  CategoryTile,
  FeaturedServiceCard,
  ProviderCard,
  ReviewsPanel,
  ServiceCard,
  SummaryRail,
} from '../../components/cards';
import { useApp } from '../../state/AppState';

const categories = ['Repairs', 'Cleaning', 'Errands', 'Assembly', 'Tech help', 'Yard & garden'];

/** Shown when a route points at a record that is not in Firestore. */
function MissingRecord({ title, body }: { title: string; body: string }) {
  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-4 pt-9">
        <div className="card mt-6 px-6 py-16 text-center">
          <h2 className="card-title">{title}</h2>
          <p className="mx-auto mt-2 max-w-[400px] text-[13px] leading-[1.7] text-[var(--color-muted)]">{body}</p>
          <Link to="/app/explore" className="btn btn-primary mt-5">
            Explore services
          </Link>
        </div>
      </main>
    </div>
  );
}

function CategoryRail({ active }: { active?: string }) {
  return (
    <div className="grid grid-cols-6 gap-3 max-md:grid-cols-3">
      {categories.map((category) => (
        <CategoryTile
          key={category}
          label={category}
          active={active === category}
          to={`/app/categories?c=${encodeURIComponent(category)}`}
        />
      ))}
    </div>
  );
}

type CatalogueFilters = { maxRate: number; minRating: number; maxKm: number };
const NO_FILTERS: CatalogueFilters = { maxRate: 0, minRating: 0, maxKm: 0 };

function kmOf(distance: string) {
  const value = Number.parseFloat(distance);
  return Number.isFinite(value) ? value : 0;
}

function applyFilters<T extends { rate: number; rating: number; distance: string }>(
  rows: T[],
  filters: CatalogueFilters,
) {
  return rows.filter(
    (row) =>
      (!filters.maxRate || row.rate <= filters.maxRate) &&
      (!filters.minRating || row.rating >= filters.minRating) &&
      (!filters.maxKm || (kmOf(row.distance) > 0 && kmOf(row.distance) <= filters.maxKm)),
  );
}

function FilterRail({
  value,
  onChange,
}: {
  value: CatalogueFilters;
  onChange: (next: CatalogueFilters) => void;
}) {
  return (
    <aside className="w-[190px] shrink-0 max-md:w-full">
      <div className="card p-5">
        <h2 className="text-[15px] font-semibold">Refine your search</h2>
        <div className="mt-3 space-y-3 text-[12.5px]">
          <label className="block">
            <span className="text-[var(--color-muted)]">Maximum hourly rate</span>
            <select
              className="field mt-1"
              value={value.maxRate}
              onChange={(event) => onChange({ ...value, maxRate: Number(event.target.value) })}
            >
              <option value={0}>Any rate</option>
              <option value={300}>Up to ₱300 / hr</option>
              <option value={500}>Up to ₱500 / hr</option>
              <option value={800}>Up to ₱800 / hr</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[var(--color-muted)]">Minimum rating</span>
            <select
              className="field mt-1"
              value={value.minRating}
              onChange={(event) => onChange({ ...value, minRating: Number(event.target.value) })}
            >
              <option value={0}>Any rating</option>
              <option value={4}>4.0 stars and above</option>
              <option value={4.5}>4.5 stars and above</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[var(--color-muted)]">Distance</span>
            <select
              className="field mt-1"
              value={value.maxKm}
              onChange={(event) => onChange({ ...value, maxKm: Number(event.target.value) })}
            >
              <option value={0}>Any distance</option>
              <option value={5}>Within 5 km</option>
              <option value={10}>Within 10 km</option>
              <option value={25}>Within 25 km</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={() => onChange(NO_FILTERS)}
          className="btn btn-ghost btn-pill btn-block mt-6 h-[38px] text-[12.5px]"
        >
          Clear filters
        </button>
      </div>
      <div className="tip mt-4">
        <p className="font-medium">A little help goes a long way</p>
        <p className="mt-1">Browse profiles and reviews before booking.</p>
      </div>
    </aside>
  );
}

function FilterStrip({ active }: { active?: string }) {
  const { services } = useApp();
  const counts = new Map<string, number>();
  for (const service of services) counts.set(service.category, (counts.get(service.category) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!groups.length) return null;
  return (
    <div className="flex items-center gap-3 overflow-x-auto rounded-[10px] border border-[var(--color-line)] bg-white px-4 py-2.5 text-[12px]">
      <Link
        to="/app/explore"
        className={`shrink-0 whitespace-nowrap ${active ? 'text-[var(--color-muted)]' : 'text-[var(--color-brand-deep)]'}`}
      >
        All services
      </Link>
      {groups.map(([category, count]) => (
        <span key={category} className="flex shrink-0 items-center gap-3 whitespace-nowrap">
          <span className="text-[var(--color-line)]">·</span>
          <Link
            to={`/app/categories?c=${encodeURIComponent(category)}`}
            className={active === category ? 'text-[var(--color-brand-deep)]' : 'text-[var(--color-muted)]'}
          >
            {category} ({count})
          </Link>
        </span>
      ))}
    </div>
  );
}

export function HomePage() {
  const { profile, bookings, services } = useApp();
  const next = bookings.find((b) => b.status === 'confirmed');
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const nearby = services.slice(0, 2);
  const topRated = [...services]
    .filter((service) => service.rating > 0)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3);

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-4 pt-9">
        <PageHeader title="Home" subtitle={`Hi, ${profile.name.split(' ')[0]}. A helping hand, close to home.`} />

        <form
          className="mt-6"
          onSubmit={(event) => {
            event.preventDefault();
            navigate(`/app/search?q=${encodeURIComponent(query || 'Furniture assembly')}`);
          }}
        >
          <SearchInput placeholder="What do you need help with?" value={query} onChange={setQuery} />
        </form>

        <div className="mt-5">
          <CategoryRail />
        </div>

        <div className="mt-9 grid grid-cols-[210px_1fr] gap-6 max-md:grid-cols-1">
          <aside className="flex flex-col gap-4">
            <div className="card p-5">
              <h2 className="card-title">Next on your calendar</h2>
              {next ? (
                <div className="mt-2 space-y-0.5 text-[12.5px] text-[var(--color-muted)]">
                  <p className="capitalize">{next.status.replace('_', ' ')}</p>
                  <p>{next.service}</p>
                  <p>{next.provider}</p>
                  <p>
                    {next.date} · {next.time}
                  </p>
                  <Link
                    to={`/app/bookings/${next.id}`}
                    className="mt-2 inline-block text-[var(--color-ink-2)] hover:underline"
                  >
                    View booking →
                  </Link>
                </div>
              ) : (
                <div className="mt-2 text-[12.5px] text-[var(--color-muted)]">
                  <p>No upcoming booking.</p>
                  <Link to="/app/explore" className="mt-2 inline-block text-[var(--color-ink-2)] hover:underline">
                    Find help nearby →
                  </Link>
                </div>
              )}
            </div>
            <Callout title="A little help goes a long way">Browse profiles and reviews before booking.</Callout>
          </aside>

          <section>
            <SectionHead
              title="Great help nearby"
              action={
                <Link to="/app/explore" className="link text-[13px]">
                  See all
                </Link>
              }
            />
            <div className="mt-4 grid grid-cols-2 gap-5 max-xl:grid-cols-1">
              {nearby.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
            <section className="mt-8">
              <SectionHead
                title="Top rated nearby"
                action={
                  <Link to="/app/explore" className="link text-[13px]">
                    See all
                  </Link>
                }
              />
              {topRated.length === 0 ? (
                <p className="mt-3 text-[12.5px] text-[var(--color-muted)]">
                  No rated ServMates near you yet — the first reviews will show up here.
                </p>
              ) : (
                <div className="mt-4 grid grid-cols-3 gap-4 max-xl:grid-cols-1">
                  {topRated.map((service) => (
                    <ServiceCard key={service.id} service={service} />
                  ))}
                </div>
              )}
            </section>
            <section className="mt-8">
              <SectionHead
                title="A little help, in three steps"
                action={<span className="text-[12.5px] text-[var(--color-muted)]">Swipe for more →</span>}
              />
              <div className="mt-4 grid grid-cols-3 gap-4 max-md:grid-cols-1">
                {[
                  ['1', 'Search nearby', 'Describe the task and pick a day that works for you.'],
                  ['2', 'Pick your ServMate', 'Compare ratings and reviews from real bookings.'],
                  ['3', 'Book and relax', 'Confirm the time, then pay once the job is done.'],
                ].map(([step, title, body]) => (
                  <div key={step} className="card p-5">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-soft)] text-[12.5px] font-semibold text-[var(--color-brand-deep)]">
                      {step}
                    </span>
                    <p className="mt-3 text-[14px] font-medium">{title}</p>
                    <p className="mt-1 text-[12.5px] leading-[1.65] text-[var(--color-muted)]">{body}</p>
                  </div>
                ))}
              </div>
            </section>
            <div className="mt-5 rounded-[12px] bg-[var(--color-soft)] px-5 py-4">
              <p className="text-[13px] font-medium text-[var(--color-brand-deep)]">Your skills. Someone’s day made.</p>
              <p className="mt-0.5 text-[12.5px] text-[#3e5a4e]">
                Become a ServMate · Share your skills and earn on your schedule.
              </p>
            </div>
          </section>
        </div>
        <FooterNote />
      </main>
    </div>
  );
}

export function ExplorePage() {
  const { services, profile } = useApp();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(NO_FILTERS);
  const shown = applyFilters(services, filters);
  const navigate = useNavigate();
  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-4 pt-9">
        <PageHeader
          title="Explore"
          subtitle={`${profile.city.trim() || 'Your area'} · ${shown.length} live service${shown.length === 1 ? '' : 's'}`}
        />
        <form
          className="mt-6"
          onSubmit={(event) => {
            event.preventDefault();
            navigate(`/app/search?q=${encodeURIComponent(query)}`);
          }}
        >
          <SearchInput placeholder="Search services" value={query} onChange={setQuery} />
        </form>
        <div className="mt-3">
          <FilterStrip />
        </div>

        <div className="mt-7 flex gap-6 max-md:flex-col">
          <FilterRail value={filters} onChange={setFilters} />
          <section className="min-w-0 flex-1">
            <SectionHead
              title={`${shown.length} ${shown.length === 1 ? 'service' : 'services'} near ${
                profile.city.trim() || 'your area'
              }`}
              action={
                <Link to="/app/explore" className="link text-[12.5px]">
                  See all services
                </Link>
              }
            />
            <div className="mt-4 grid grid-cols-2 gap-5 max-xl:grid-cols-1">
              {shown.slice(0, 2).map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
            <div className="mt-5 rounded-[12px] bg-[var(--color-soft)] px-5 py-4">
              <p className="text-[13px] font-medium text-[var(--color-brand-deep)]">Compare the people, not just the price.</p>
              <p className="mt-0.5 text-[12.5px] text-[#3e5a4e]">
                See experience, customer reviews and available times before choosing your ServMate.
              </p>
            </div>
          </section>
        </div>
        <FooterNote />
      </main>
    </div>
  );
}

export function CategoriesPage() {
  const { bookings, services, profile } = useApp();
  const next = bookings.find((b) => b.status === 'confirmed');
  const [value, setValue] = useState('');
  const navigate = useNavigate();
  const counts = new Map<string, number>();
  for (const service of services) counts.set(service.category, (counts.get(service.category) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const columns = [groups.slice(0, Math.ceil(groups.length / 2)), groups.slice(Math.ceil(groups.length / 2))];
  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-4 pt-9">
        <PageHeader title="What needs doing?" subtitle="Everyday tasks. Good people to help." />
        <form
          className="mt-6"
          onSubmit={(event) => {
            event.preventDefault();
            const next = value.trim();
            if (next) navigate(`/app/search?q=${encodeURIComponent(next)}`);
          }}
        >
          <SearchInput placeholder="Search categories" value={value} onChange={setValue} />
        </form>
        <div className="mt-5">
          <CategoryRail />
        </div>

        {groups.length ? (
          <div className="mt-7 grid grid-cols-2 gap-6 max-lg:grid-cols-1">
            {columns.map((column, index) => (
              <div key={index} className="card p-5">
                <h2 className="card-title">{index === 0 ? 'Help around the home' : 'Make room for your day'}</h2>
                <div className="mt-2 space-y-2 text-[12.5px]">
                  {column.length ? (
                    column.map(([category, count]) => (
                      <div key={category}>
                        <Link
                          to={`/app/categories?c=${encodeURIComponent(category)}`}
                          className="flex items-center justify-between gap-3 text-[var(--color-ink-2)] hover:underline"
                        >
                          <span>{category}</span>
                          <span className="text-[var(--color-muted-2)]">
                            {count} service{count === 1 ? '' : 's'} →
                          </span>
                        </Link>
                      </div>
                    ))
                  ) : (
                    <p className="text-[var(--color-muted)]">No categories here yet.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card mt-7 px-6 py-12 text-center">
            <h2 className="card-title">No live categories yet</h2>
            <p className="mx-auto mt-2 max-w-[380px] text-[13px] text-[var(--color-muted)]">
              ServMates publish their services here. Check back soon, or share your own skills.
            </p>
            <Link to="/mate/apply" className="btn btn-primary btn-pill mt-5">
              Become a ServMate
            </Link>
          </div>
        )}

        <div className="mt-5 rounded-[12px] bg-[var(--color-soft)] px-5 py-4">
          <p className="text-[12.5px] font-medium text-[var(--color-brand-deep)]">
            Showing {services.length} service{services.length === 1 ? '' : 's'} near {profile.city.trim() || 'your area'}
          </p>
          <p className="mt-0.5 text-[12px] text-[#3e5a4e]">
            Distances are approximate. Choose a service to see pricing and available times.
          </p>
        </div>

        <div className="mt-7">
          <SectionHead
            title="Next on your calendar"
            action={
              <Link to={next ? `/app/bookings/${next.id}` : '/app/bookings'} className="link text-[13px]">
                View booking
              </Link>
            }
          />
          <div className="card mt-3 flex items-center justify-between p-5 text-[12.5px] text-[var(--color-muted)]">
            <div>
              <p className="text-[13px] font-medium text-[var(--color-ink)]">
                {next?.service ?? 'No upcoming booking'}
              </p>
              <p className="mt-1">
                {next
                  ? `${next.provider} · ${next.date} · ${next.time}`
                  : 'Book help and it will appear here.'}
              </p>
            </div>
            {next ? <Chip small>Confirmed</Chip> : null}
          </div>
        </div>
        <FooterNote />
      </main>
    </div>
  );
}

export function SearchResultsPage() {
  const { services, profile } = useApp();
  const [params, setParams] = useSearchParams();
  const query = params.get('q')?.trim() ?? '';
  const [value, setValue] = useState(query);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sort, setSort] = useState<'recommended' | 'price' | 'rating'>('recommended');

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matched = words.length
    ? services.filter((service) =>
        words.every((word) =>
          `${service.name} ${service.category} ${service.description}`.toLowerCase().includes(word),
        ),
      )
    : services;
  const filtered = applyFilters(matched, filters);
  const shown = [...filtered].sort((a, b) =>
    sort === 'price' ? a.rate - b.rate : sort === 'rating' ? b.rating - a.rating : b.reviews - a.reviews,
  );
  const area = profile.city.trim() || shown[0]?.area || 'your area';

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-4 pt-9">
        <PageHeader
          title="Search results"
          subtitle={`${area} · ${shown.length} service${shown.length === 1 ? '' : 's'}${
            query ? ` match “${query}”` : ' available'
          }`}
        />
        <form
          className="mt-6"
          onSubmit={(event) => {
            event.preventDefault();
            const next = value.trim();
            setParams(next ? { q: next } : {});
          }}
        >
          <SearchInput placeholder="Search services" value={value} onChange={setValue} />
        </form>
        <div className="mt-3">
          <FilterStrip />
        </div>
        <div className="mt-7 flex gap-6 max-lg:flex-col">
          <FilterRail value={filters} onChange={setFilters} />
          <section className="min-w-0 flex-1">
            <SectionHead
              title={`${shown.length} service${shown.length === 1 ? '' : 's'} near ${area}`}
              action={
                <label className="flex items-center gap-2 text-[12.5px] text-[var(--color-muted)]">
                  Sort
                  <select
                    className="field h-[34px] py-0 text-[12.5px]"
                    value={sort}
                    onChange={(event) => setSort(event.target.value as typeof sort)}
                    aria-label="Sort results"
                  >
                    <option value="recommended">Recommended</option>
                    <option value="price">Lowest price</option>
                    <option value="rating">Highest rated</option>
                  </select>
                </label>
              }
            />
            {shown.length === 0 ? (
              <div className="card mt-4 px-6 py-14 text-center">
                <h2 className="card-title">
                  {query ? `No services match “${query}”` : 'No services match these filters'}
                </h2>
                <p className="mx-auto mt-2 max-w-[380px] text-[13px] text-[var(--color-muted)]">
                  Try a broader word or clear the filters, or browse every live service near you.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <button type="button" className="btn btn-ghost btn-pill" onClick={() => setFilters(NO_FILTERS)}>
                    Clear filters
                  </button>
                  <Link to="/app/explore" className="btn btn-primary btn-pill">
                    Browse all services
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-5 max-xl:grid-cols-1">
                {shown.slice(0, 8).map((service) => (
                  <ServiceCard key={service.id} service={service} />
                ))}
              </div>
            )}
            <div className="mt-5 rounded-[12px] bg-[var(--color-soft)] px-5 py-4">
              <p className="text-[13px] font-medium text-[var(--color-brand-deep)]">Not sure where to start?</p>
              <p className="mt-0.5 text-[12.5px] text-[#3e5a4e]">
                Describe the task in your own words — your ServMate will confirm the details before the visit.
              </p>
            </div>
          </section>
        </div>
        <FooterNote />
      </main>
    </div>
  );
}

export function CategoryPage() {
  const { services, profile } = useApp();
  const { c } = useParams();
  const category = c || 'Cleaning';
  const [filters, setFilters] = useState(NO_FILTERS);
  const [value, setValue] = useState('');
  const navigate = useNavigate();
  const matches = applyFilters(
    services.filter((service) => service.category === category),
    filters,
  );
  if (matches.length === 0) {
    return (
      <MissingRecord
        title={`No ${category.toLowerCase()} services yet`}
        body="Nobody has published in this category near you so far. Explore another category in the meantime."
      />
    );
  }
  const primary = matches[0];
  const featured = matches[1] ?? matches[0];
  const area = profile.city.trim() || matches[0].area || 'your area';

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-4 pt-9">
        <PageHeader
          title={category === 'Cleaning' ? 'Home cleaning' : category}
          subtitle={`${area} · ${matches.length} live service${matches.length === 1 ? '' : 's'}`}
        />
        <form
          className="mt-6"
          onSubmit={(event) => {
            event.preventDefault();
            const next = value.trim();
            if (next) navigate(`/app/search?q=${encodeURIComponent(next)}`);
          }}
        >
          <SearchInput placeholder={`Search ${category.toLowerCase()}`} value={value} onChange={setValue} />
        </form>
        <div className="mt-3">
          <FilterStrip active={category} />
        </div>
        <div className="mt-7 flex gap-6 max-lg:flex-col">
          <FilterRail value={filters} onChange={setFilters} />
          <section className="min-w-0 flex-1">
            <SectionHead title={`${matches.length} services · ${area}`} />
            <div className="mt-4 grid grid-cols-2 gap-5 max-xl:grid-cols-1">
              <ServiceCard service={primary} />
              <FeaturedServiceCard service={featured} />
            </div>
            <div className="mt-5 rounded-[12px] bg-[var(--color-soft)] px-5 py-4">
              <p className="text-[13px] font-medium text-[var(--color-brand-deep)]">Compare the people, not just the price.</p>
              <p className="mt-0.5 text-[12.5px] text-[#3e5a4e]">
                See experience, customer reviews and available times before choosing your ServMate.
              </p>
            </div>
          </section>
        </div>
        <FooterNote />
      </main>
    </div>
  );
}

export function ServiceDetailPage() {
  const { services, servMates, reviews } = useApp();
  const { id } = useParams();
  const service = services.find((s) => s.id === id);
  const mate = service ? servMates.find((m) => m.id === service.providerId) : undefined;
  if (!service || !mate) {
    return (
      <MissingRecord
        title="That service is not available"
        body="It may have been paused by the ServMate or the link is out of date. Explore other services nearby."
      />
    );
  }

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-4 pt-9">
        <PageHeader
          title="Service details"
          subtitle={service.area ? `${service.area} · ${service.distance || 'distance at booking'}` : service.distance || 'Distance confirmed at booking'}
          actions={
            <Link to={`/app/book/${service.id}/date`} className="btn btn-primary btn-pill btn-sm h-[40px] px-6">
              Book Now
            </Link>
          }
        />
        <div className="mt-6 flex gap-6 max-lg:flex-col">
          <div className="min-w-0 flex-1">
            <img
              src={mate.cover}
              alt={`${mate.name} at work`}
              className="h-[240px] w-full rounded-[14px] object-cover"
            />
            <Chip small className="mt-5 uppercase tracking-[0.06em]">
              {service.category}
            </Chip>
            <h2 className="mt-3 text-[28px] font-semibold leading-[1.2] tracking-[-0.02em]">
              {service.name === 'Home cleaning' ? 'A fresh space, a lighter day.' : 'From box to built.'}
            </h2>
            <p className="mt-3 max-w-[600px] text-[13px] leading-[1.7] text-[var(--color-muted)]">{service.description}</p>
            <ReviewsPanel reviews={reviews} className="mt-6" />
          </div>
          <SummaryRail service={service} />
        </div>
        <FooterNote />
      </main>
    </div>
  );
}

export function ServMateProfilePage() {
  const { services, servMates, reviews } = useApp();
  const { id } = useParams();
  const mate = servMates.find((m) => m.id === id);
  const service = mate ? services.find((s) => s.providerId === mate.id) : undefined;
  if (!mate) {
    return (
      <MissingRecord
        title="That ServMate is not available"
        body="Their profile may be paused or under review. Explore other ServMates nearby."
      />
    );
  }
  if (!service) {
    return (
      <MissingRecord
        title="No published service yet"
        body="This ServMate has no live listing right now, so there is nothing to book."
      />
    );
  }

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-4 pt-9">
        <PageHeader
          title="Meet your ServMate"
          subtitle={mate.area ? `${mate.area} · ${mate.distance || 'distance at booking'}` : mate.distance || 'Distance confirmed at booking'}
          actions={
            <Link to={`/app/services/${service.id}`} className="btn btn-primary btn-pill btn-sm h-[40px] px-6">
              View service
            </Link>
          }
        />
        <div className="mt-6 flex gap-6 max-lg:flex-col">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-4">
              <img src={mate.photo} alt="" className="h-16 w-16 rounded-full object-cover" />
              <div>
                <h2 className="text-[22px] font-semibold tracking-[-0.02em]">{mate.name}</h2>
                <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">
                  {mate.area || 'Your area'}{mate.distance ? ` · ${mate.distance}` : ''}
                </p>
                <Chip small className="mt-2">
                  {mate.verified ? 'Verified ServMate' : 'Profile in review'}
                </Chip>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-3 gap-4 max-sm:grid-cols-1">
              {[
                ['Average rating', mate.rating.toFixed(1), 'From neighbors like you'],
                ['Completed jobs', String(mate.jobs), 'Carefully taken care of'],
                ['Reviews', String(mate.reviews), 'Realistic sample content'],
              ].map(([label, value, note]) => (
                <div key={label} className="rounded-[14px] bg-[var(--color-soft)] px-5 py-4">
                  <p className="text-[11px] text-[#3e5a4e]">{label}</p>
                  <p className="mt-2 text-[26px] font-semibold tracking-[-0.02em] text-[var(--color-brand-deep)]">{value}</p>
                  <p className="mt-1 text-[11px] text-[#4b6a5c]">{note}</p>
                </div>
              ))}
            </div>

            <p className="mt-5 max-w-[640px] text-[13px] leading-[1.7] text-[var(--color-muted)]">{mate.bio}</p>

            <div className="mt-4 flex items-center gap-3 rounded-[10px] border border-[var(--color-line)] bg-white px-4 py-2.5 text-[11.5px] text-[var(--color-muted)]">
              <span className="rounded bg-[var(--color-soft)] px-2 py-0.5 font-medium text-[var(--color-brand-deep)]">
                {mate.skills[0]}
              </span>
              <span>·</span>
              <span>{mate.skills[1] ?? 'Small repairs'}</span>
              <span>·</span>
              <span>5 years’ experience</span>
            </div>

            <ReviewsPanel reviews={reviews.slice(0, 1)} className="mt-4" />
          </div>

          <aside className="flex w-[332px] shrink-0 flex-col gap-4 max-lg:w-full">
            <ProviderCard mate={mate} />
            <div className="rail-card">
              <p className="text-[15px] font-medium">₱{mate.rate} / hr</p>
              <div className="mt-2 space-y-1 text-[12.5px] text-[var(--color-muted)]">
                <p>2-hour minimum</p>
                <p>Next available · {mate.availability}</p>
                <p>{service.availability}</p>
                <p>Approximate distance {mate.distance}</p>
                <p className="leading-[1.6]">Service area · {mate.area || 'Set by the ServMate'}.</p>
              </div>
              <Link to={`/app/book/${service.id}/date`} className="btn btn-primary btn-block mt-4">
                Book Now
              </Link>
            </div>
            <Callout title="A little privacy, by design">
              Exact addresses and contact details stay private until a booking is accepted.
            </Callout>
          </aside>
        </div>
        <FooterNote />
      </main>
    </div>
  );
}

export function SavedHelpPage() {
  const { favorites, toggleFavorite, bookings, services, servMates } = useApp();
  const saved = services.filter((s) => favorites.has(s.id));
  const shown = saved;
  const [tab, setTab] = useState<'services' | 'servmates'>('services');
  const next = bookings.find((b) => b.status === 'confirmed');

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-4 pt-9">
        <PageHeader title="Your saved help" subtitle="A short list of people and services to come back to." />
        <SearchInput className="mt-6" placeholder="Search saved help" />

        <div className="mt-4 flex gap-8 border-b border-[var(--color-line)]">
          {[
            ['services', 'Saved services'],
            ['servmates', 'Saved ServMates'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key as 'services' | 'servmates')}
              className={`-mb-px border-b-2 pb-3 text-[13px] ${
                tab === key
                  ? 'border-[var(--color-brand)] font-medium text-[var(--color-brand-deep)]'
                  : 'border-transparent text-[var(--color-muted)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-[190px_1fr] gap-6 max-lg:grid-cols-1">
          <aside>
            <div className="card p-5 text-[12.5px] text-[var(--color-muted)]">
              <p className="font-medium text-[var(--color-ink)]">Next on your calendar</p>
              {next ? (
                <>
                  <p className="mt-2">{next.service}</p>
                  <p>{next.provider}</p>
                  <p>
                    {next.date} · {next.time}
                  </p>
                </>
              ) : (
                <p className="mt-2">No upcoming booking.</p>
              )}
              <Link to={next ? `/app/bookings/${next.id}` : '/app/bookings'} className="mt-2 inline-block text-[var(--color-ink-2)] hover:underline">
                View booking →
              </Link>
            </div>
            <div className="tip mt-4">
              <p className="font-medium">A little help goes a long way</p>
              <p className="mt-1">Browse profiles and reviews before booking.</p>
            </div>
          </aside>

          <section className="min-w-0">
            {tab === 'services' ? (
              <>
                <SectionHead
                  title="Saved services"
                  action={
                    <Link to="/app/explore" className="link text-[13px]">
                      See all services
                    </Link>
                  }
                />
                {shown.length === 0 ? (
                  <p className="mt-4 rounded-[12px] bg-[var(--color-soft)] px-5 py-6 text-[13px] text-[var(--color-muted)]">
                    Nothing saved yet. Tap Save on a service or a ServMate to keep them here.
                  </p>
                ) : null}
                <div className="mt-4 grid grid-cols-2 gap-5 max-xl:grid-cols-1">
                  {shown.map((service) => (
                    <div key={service.id} className="relative">
                      <ServiceCard service={service} />
                      <button
                        type="button"
                        onClick={() => toggleFavorite(service.id)}
                        className="absolute right-3 top-3 inline-flex min-h-[24px] items-center rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium text-[var(--color-brand-deep)] backdrop-blur"
                        aria-label={`${favorites.has(service.id) ? 'Remove' : 'Save'} ${service.name}`}
                      >
                        {favorites.has(service.id) ? 'Saved' : 'Save'}
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-5">
                  <SectionHead
                    title="Saved ServMates"
                    action={
                      <Link to="/app/explore" className="link text-[13px]">
                        See all profiles
                      </Link>
                    }
                  />
                  <div className="mt-3">
                    <ProviderCard mate={servMates[0]} />
                  </div>
                </div>
              </>
            ) : (
              <div className="grid gap-3">
                {servMates.slice(0, 3).map((mate) => (
                  <ProviderCard key={mate.id} mate={mate} />
                ))}
              </div>
            )}
            <div className="mt-5 rounded-[12px] bg-[var(--color-soft)] px-5 py-4">
              <p className="text-[13px] font-medium text-[var(--color-brand-deep)]">Comparison is welcome, pressure is not.</p>
              <p className="mt-0.5 text-[12.5px] text-[#3e5a4e]">No timers, no pop-ups. Take the time you need.</p>
            </div>
          </section>
        </div>
        <FooterNote />
      </main>
    </div>
  );
}
