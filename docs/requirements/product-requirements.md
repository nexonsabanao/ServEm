# ServEm — Product Requirements

## 1. What ServEm is

A service marketplace for the Philippine market with three experiences on one identity:

1. **Public discovery** — browse published service listings and ServMate profiles.
2. **Private job matching** — a customer posts a job; only eligible ServMates see it.
3. **A provider's own showcase** — profile, listings, portfolio and work updates.

**Terminology is fixed** (§1 of the blueprint): ServEm, Customer, ServMate, User Profile,
ServMate Profile, Service Listing, Job Post, Job Offer, Conversation, Booking, Portfolio, Job
Media. There is no "shop" entity: a ServMate has a profile that includes their listings, their
portfolio and their reviews.

One account may be both a customer and a ServMate. Capability is a flag beside the customer
profile, not a second account type.

## 2. The rule the product turns on

**Public service discovery and private job discovery are different things and must never be
confused.** A cleaning job posted by a customer is visible to eligible ServMates with the
Cleaning category who cover its city, and to nobody else — not to plumbers, not to other
customers, not to visitors, and not through a guessed link, a count, an error message or a media
URL.

Everything in `docs/security/access-control.md` exists to keep that true.

## 3. Customer requirements

| # | Requirement | Where it lives |
|---|---|---|
| C1 | Register, sign in, manage the account | `lib/auth.ts`, `/api/auth/*` |
| C2 | Browse published services and ServMate profiles | `/`, `/home`, `/providers/[providerId]` |
| C3 | Post a job: title, description, category, budget, location, schedule | `/account/jobs/new` |
| C4 | Attach photos and videos to the job, visible only to entitled parties | `/api/jobs/[id]/media` |
| C5 | Publish the job to private discovery, or keep it as a draft | `/api/jobs/[id]/publish` |
| C6 | Receive and compare offers, cheapest first, each with the ServMate behind it | `/account/jobs/[jobId]` |
| C7 | Accept one offer, which books the work at that price and withdraws the rest | `/api/jobs/[id]/offers/[offerId]/accept` |
| C8 | Track booked work and confirm its completion | `/account/jobs/[jobId]`, `/api/bookings/[id]/confirm` |
| C9 | Review completed work once | `/api/bookings/[id]/review` |
| C10 | Report or block an account or a job | `/api/reports`, `/api/blocks/[userId]` |
| C11 | See what happened to their own jobs and bookings | `/account/notifications` |

A customer never sees another customer's job, its media, or its offers.

## 4. ServMate requirements

| # | Requirement | Where it lives |
|---|---|---|
| S1 | Enable provider capability on the existing account | `/api/servmate/onboard` |
| S2 | State profile facts: headline, about, experience, home area, reply time | `/api/servmate/me` |
| S3 | Choose the structured categories they work in and the areas they cover | `/api/servmate/me/categories`, `.../coverage` |
| S4 | Create, edit, publish, withdraw and delete service listings | `/api/servmate/me/services` |
| S5 | Publish a portfolio and work updates | `/api/servmate/me/portfolio`, `.../posts` |
| S6 | Discover only eligible private jobs, with filters that narrow | `/servmate/jobs` |
| S7 | Open an entitled job, including its barangay and access notes | `/servmate/jobs/[jobId]` |
| S8 | Submit, withdraw and track offers | `/api/servmate/me/offers` |
| S9 | Manage assigned work through the permitted transitions | `/api/bookings/[id]/start`, `.../complete` |
| S10 | Receive reviews, see the aggregate | provider page, `/account/notifications` |

A ServMate never sees an unrelated or ineligible job, cannot edit another provider's profile or
listings, and cannot hold two live offers on one job.

## 5. Product rules that are not obvious

1. **A budget is not a price.** The job carries what the customer will pay; the offer carries
   the proposal; the booking freezes what was agreed. Editing one never rewrites another.
2. **Money never moves through the service.** A booking records the agreed amount and the two
   sides settle directly, which is why no payment step exists.
3. **Self-declared is labelled as such.** Nothing claims a credential was checked until a
   verification process says so, and a portfolio item is marked verified only when it comes
   from a booking the platform watched complete.
4. **Discovery summaries are deliberately thin** — city, category, budget, schedule — because
   the exact address is what a customer is trusting the marketplace to protect.
5. **A refusal is indistinguishable from an absence.** An ineligible provider, an unrelated
   customer and a guessed id all get the same answer.
6. **A report is a record, not a verdict.** It changes nobody's visibility; a moderator decides.
   A block, by contrast, takes effect immediately and is reversible.
7. **Nothing pretends to work.** Where a decision has not been made — payouts, deletion,
   two-factor, email recovery — the interface says so and offers no control.

## 6. Non-goals at this revision

Payments and payouts, KYC/verification, geocoding and distance search, availability calendars,
dispute adjudication, counteroffer negotiation, multi-provider jobs, and any public marketplace
metric the platform cannot substantiate from stored records.
