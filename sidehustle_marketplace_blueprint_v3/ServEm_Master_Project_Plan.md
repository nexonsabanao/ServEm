# ServEm --- Master Project Update Plan

## Product Requirements, User Flows, Data Requirements, Architecture, and Implementation Instructions

**Document purpose:** This file is the source-of-truth instruction
document for an AI coding agent working on the existing ServEm
repository.

**Application:** ServEm\
**Service providers/task doers:** ServMates\
**Primary users:** Customers and ServMates\
**Product type:** E-commerce-style service marketplace with social
profiles, private category-matched job posts, location-based discovery,
messaging, offers, and bookings.

------------------------------------------------------------------------

# 0. MASTER INSTRUCTION TO THE AI CODING AGENT

Act as a **Senior Software Architect, Product Designer, Full-Stack
Developer, Database Engineer, Security Engineer, and QA Engineer**.

Your task is to inspect, redesign, and update my entire existing
application, **ServEm**, into a modern, secure, e-commerce-style service
marketplace.

Do not create an unrelated new application. Work with the existing
repository, preserve working features, identify architectural problems,
and implement the required improvements across the frontend, backend,
database, APIs, storage, and documentation.

Do not stop at planning or mockups. Implement the changes incrementally
and test them.

Before editing: 1. Inspect the complete repository and read the existing
project documentation. 2. Identify the actual technology stack, entry
points, modules, database, API structure, authentication, storage, and
deployment setup. 3. Check the Git status and preserve uncommitted user
changes. 4. Run the existing tests, linting, type checks, and builds
where feasible to establish a baseline. 5. Record existing failures
separately from failures introduced by your changes. 6. Compare the
existing implementation against this specification. 7. Create a
prioritized implementation plan based on actual repository evidence.

Then implement changes in small, reviewable batches. After each batch,
run relevant checks, update documentation, and record progress. Do not
claim that functionality works unless it has been verified.

If this document conflicts with an existing implementation, investigate
before changing it. Preserve working behavior unless a documented
requirement or technical reason justifies a change. Ask for
clarification only when ambiguity materially affects business rules,
security, data integrity, or architecture. Otherwise, record a
reasonable assumption and continue.

Do not perform destructive database operations, discard user changes, or
run destructive Git commands without explicit approval.

------------------------------------------------------------------------

# 1. PRODUCT IDENTITY AND TERMINOLOGY

Use these terms consistently throughout the user interface, code
comments where relevant, API documentation, and product documentation.

-   **ServEm:** The application and marketplace brand.
-   **Customer:** A user who needs a service and publishes a job post.
-   **ServMate:** A service provider or task doer who offers services
    and completes jobs.
-   **User Profile:** A user's account identity and profile information.
-   **ServMate Profile:** The provider's profile, service listings,
    portfolio, posts, and reviews.
-   **Service Listing:** A specific service offered by a ServMate.
-   **Job Post:** A customer's private request for a particular task.
-   **Job Offer:** A ServMate's proposed price, schedule, and terms for
    a job.
-   **Conversation:** A private messaging thread.
-   **Booking:** An accepted arrangement between a customer and a
    ServMate.
-   **Portfolio:** Work examples displayed on a ServMate profile.
-   **Job Media:** Photos and videos attached to a customer's job.

**Important naming rule:** There is no separate "ServMate Shop." A
ServMate has a profile that combines personal/professional identity,
service listings, portfolio, posts, and reviews. Do not introduce a
separate shop entity or shop-management section.

A single account may have both customer and ServMate capabilities if the
existing architecture supports this cleanly. Avoid forcing duplicate
accounts without a strong business reason.

------------------------------------------------------------------------

# 2. PRODUCT VISION

ServEm combines three core experiences:

1.  An e-commerce-style marketplace for discovering public services and
    ServMate profiles.
2.  Social-style profiles and work portfolios, including images, videos,
    posts, and reviews.
3.  A private, category-matched job marketplace that connects customers
    to eligible ServMates.

The UI may be inspired by Shopee-style service discovery and product
cards, combined with Facebook-style profiles and activity feeds. Do not
copy another brand's proprietary assets. Create a consistent ServEm
design system.

## 2.1 Public discovery versus private job discovery

These are separate experiences and must never be confused.

**Public service discovery:** Visitors and authorized users may browse
public ServMate profiles and published service listings according to
visibility rules.

**Private job discovery:** Only authenticated, eligible ServMates may
discover matching customer job posts.

Example: if a customer posts a house-cleaning job, only eligible
ServMates who offer the Cleaning category and meet the configured
eligibility rules can discover it. Plumbing-only providers,
electricians, other customers, and visitors must not see or retrieve the
job.

This rule applies to APIs, search, pagination, notifications, realtime
events, media, and direct links---not only the frontend.

------------------------------------------------------------------------

# 3. ACCOUNT TYPES AND PERMISSIONS

## 3.1 Customer capabilities

Customers can: - Register, sign in, and manage their accounts. - Edit
their own profiles. - Browse public service listings and ServMate
profiles. - Search and filter services. - Create, edit, publish, and
manage their own job posts. - Upload workplace photos and videos. -
Select a service category and optional subcategory. - Set a budget and
indicate whether it is fixed or negotiable. - Specify location and
preferred schedule. - Receive and compare offers from eligible
ServMates. - Message authorized ServMates. - Accept an offer and create
a booking. - Track work and booking progress. - Cancel or amend jobs
according to policy. - Confirm completion where required. - Review
eligible completed services. - Report or block users.

Customers must never access another customer's private job or unrelated
private conversations.

## 3.2 ServMate capabilities

ServMates can: - Complete provider onboarding. - Edit their own ServMate
profile. - Select structured service categories. - Configure service
areas and availability. - Create and manage their own service
listings. - Set and edit listing prices. - Upload portfolio images and
videos. - Publish work updates. - Discover only eligible private
customer jobs. - Filter eligible jobs by category, location, budget, and
schedule. - View authorized job details and workplace media. - Submit
offers and counteroffers where supported. - Message customers through
authorized conversations. - Manage assigned bookings. - Update job
progress through permitted state transitions. - Receive eligible
customer reviews. - Report or block users.

A ServMate cannot view unrelated jobs or edit another provider's profile
or listings.

## 3.3 Permission matrix

  --------------------------------------------------------------------------
  Action         Customer       Eligible       Unrelated      Visitor
                                ServMate       ServMate       
  -------------- -------------- -------------- -------------- --------------
  Browse public  Yes            Yes            Yes            According to
  services                                                    public policy

  Edit own       Yes            Yes            Yes            No
  profile                                                     

  Create job     Yes            If customer    If customer    No
  post                          capability is  capability is  
                                enabled        enabled        

  View own job   Yes            Only if also   Only if also   No
                                the owner      the owner      

  Discover       Own-job        Yes, if        No             No
  matching job   management     eligible                      
                 only                                         

  View           Owner          If authorized  No             No
  restricted job                                              
  media                                                       

  Submit job     No             If eligible    No             No
  offer                                                       

  Message about  Owner          Authorized     No             No
  a job                         participants                  

  View booking   Authorized     Assigned       No             No
                 customer       ServMate                      

  Review         Eligible       Only if        No             No
  completed      customer       separately                    
  booking                       supported                     
  --------------------------------------------------------------------------

Implement reusable server-side authorization policies. Do not scatter
inconsistent permission checks across UI components.

------------------------------------------------------------------------

# 4. DETAILED CUSTOMER USER FLOW

## 4.1 Customer journey overview

`Open ServEm → Register/sign in → Explore services or create a job → Describe task → Select category → Upload media → Set budget → Set location and schedule → Review and publish → Receive eligible offers → Message ServMates → Compare offers → Accept offer → Confirm booking → Track work → Complete job → Review ServMate`

Customers may also enter by browsing a public service listing or
visiting a ServMate profile.

## 4.2 Registration and login

Screens: - Welcome. - Registration. - Login. - Verification, where
applicable. - Password recovery. - Initial profile setup.

Flow: 1. User registers or signs in. 2. Backend validates credentials
and account status. 3. Session is established securely. 4. User
completes required profile details. 5. Application loads account
capabilities and permissions. 6. User enters the appropriate marketplace
experience.

Data requirements include account ID, normalized email/phone where
applicable, authentication-provider information, verification status,
account status, and timestamps. Never store plaintext passwords.

## 4.3 Customer homepage

The homepage should include: - Prominent search. - Service categories. -
Featured or recommended services. - Public ServMate profile cards. -
Service cards with media, title, price, and ratings where available. -
Location-aware service discovery. - Navigation to messages, bookings,
job management, and profile.

Do not place private customer job posts in the public homepage feed.

Only retrieve public/published services and profiles that the caller is
allowed to see. Apply filtering and pagination server-side.

## 4.4 Create a job post

Provide a guided "Post a Job" flow with the following steps.

### Step A --- Task description

Required: - Title. - Description. - Structured service category.
Optional: - Subcategory. - Requirements or special instructions.

Example: "House Cleaning for a Two-Storey Home," category Cleaning,
description covering the kitchen, bathrooms, living room, and bedrooms.

The backend must store category IDs and validate that the category is
active. Do not use free-text keyword matching as the primary eligibility
mechanism.

### Step B --- Workplace photos and videos

Support multiple photos and videos. Allow preview, removal, reordering,
upload progress, and useful error states.

The media is private job data. Only the job owner and authorized
eligible ServMates may access it. A guessed or leaked storage URL must
not bypass access control.

### Step C --- Budget and price

Support: - Budget amount. - Currency, with PHP as the likely default for
the Philippine market. - Fixed or negotiable budget. - Optional
minimum/maximum budget if required. - Notes about the budget.

A customer budget is not automatically the final agreed service price.
Use integer minor units or an exact decimal type---not floating-point
arithmetic---for money. Do not silently change confirmed booking terms
when a job budget is edited.

### Step D --- Location

Support: - Manual address entry. - City/municipality and barangay where
applicable. - Map selection if supported. - Device location only with
appropriate permission. - Optional access instructions.

Provide a manual alternative to GPS. Show the customer which location
details are visible during discovery. The feed should show only an
appropriate approximate location; protect the exact address until the
applicable authorization stage.

### Step E --- Schedule

Support preferred date, time or time range, flexible scheduling, and
optional deadline if required. Validate dates and store timestamps
consistently, preferably in UTC, while rendering in the user's
appropriate timezone.

### Step F --- Review and publish

Show a summary of task, category, media, budget, location, and schedule.
Allow edits before publication.

On publish, the backend must validate all data, persist the job and
media relationships, and mark the job as eligible for private discovery.
It must not enter the public service feed.

## 4.5 Matching and receiving offers

After publication, ServEm finds eligible ServMates using: 1.
Authentication and provider capability. 2. Structured service-category
eligibility. 3. Job status and publication state. 4. Exclusion of the
job owner. 5. Blocking and other eligibility rules. 6. Required
service-area and scheduling constraints.

Customers see offers in their own job-management area. Each offer may
show the ServMate profile, proposed price, proposed schedule, scope,
message, offer status, and relevant verified ratings/history.

Customers can inspect profiles, message providers, compare offers,
accept or reject offers, and counteroffer if supported.

## 4.6 Messaging

Customer messaging can be entered from an authorized ServMate profile,
relevant service listing, job offer, or booking. Job-related
conversations must be authorized against the job and its participants.

When a message is sent: 1. Authenticate the sender. 2. Verify
conversation membership. 3. Verify associated job/booking access where
relevant. 4. Validate content and attachments. 5. Persist the message.
6. Update conversation activity. 7. Publish an authorized realtime event
or make it available through polling. 8. Notify the recipient according
to preferences. 9. Update read status where supported.

Persist before reporting successful delivery. Realtime subscriptions
must not bypass access checks.

## 4.7 Accept an offer and create a booking

When a customer accepts an offer: 1. Confirm the customer owns the job.
2. Confirm the offer belongs to that job. 3. Confirm job and offer
remain eligible. 4. Confirm the ServMate remains eligible. 5. Validate
price, schedule, scope, and currency. 6. Create the booking
transactionally. 7. Store an immutable snapshot of agreed terms. 8.
Update job and offer states. 9. Notify both parties.

Use database transactions and concurrency protection to prevent
conflicting offer acceptance.

## 4.8 Track work and review

Provide a booking screen with provider details, agreed price, scope,
schedule, messages, timeline, and permitted cancellation/rescheduling
actions.

After the job is completed according to policy, allow eligible customers
to review the ServMate. Reviews must be tied to eligible bookings; do
not allow arbitrary users to create verified-work reviews.

------------------------------------------------------------------------

# 5. DETAILED SERVMATE USER FLOW

## 5.1 ServMate journey overview

`Register/sign in → Enable provider capability → Complete ServMate profile → Select service categories → Set service area and availability → Publish service listings → Discover eligible private jobs → Inspect job → Submit offer → Message customer → Confirm booking → Perform work → Update progress → Complete job → Receive review`

## 5.2 Provider onboarding and profile

Collect only information needed for the relevant onboarding stage: -
Display name. - Profile picture and cover photo. - Biography and
experience description. - Structured service categories. - Service
area. - Availability. - Credentials or verification information only
where needed.

Distinguish self-declared information from verified credentials. Do not
show verification badges until the relevant verification process
succeeds.

## 5.3 ServMate profile structure

The profile is the provider's identity and service showcase, not a
separate shop.

Sections: 1. Overview. 2. Services. 3. Portfolio. 4. Posts/work updates.
5. Reviews.

The header may show profile and cover images, display name, username,
biography, categories, optional service area, eligible rating
aggregates, verified completed-job count, and message/hire actions when
appropriate.

Keep public profile information separate from private account
information. Do not expose private addresses, identity documents, phone
numbers, or internal moderation data by default.

## 5.4 Service listings

Each listing should support: - Title and description. - Structured
category/subcategory. - Cover image or video thumbnail. - Additional
media. - Pricing model and amount. - Currency. - Service area. -
Availability. - Terms and exclusions. - Publication status.

ServMates can create, edit, publish, unpublish, and delete their own
listings subject to booking and business rules.

When a price is edited: 1. Validate on client for usability. 2. Verify
ownership on server. 3. Validate amount/currency on server. 4. Persist
the change. 5. Invalidate or update relevant caches/search indexes. 6.
Return the saved record. 7. Display success only after the server
confirms it.

A listing price change must not rewrite a confirmed booking's agreed
price.

## 5.5 Available Jobs feed

The feed is private and distinct from public service discovery.

Filters can include category, subcategory, approximate distance,
city/municipality, budget, schedule, publication time, and relevant
requirements.

Filters refine only the already-authorized result set. They must never
expand a provider's access.

A job card may show title, short description, category, approximate
location/distance, budget, preferred date, authorized thumbnails,
publication time, and status as appropriate.

Do not include exact address or sensitive customer data in the general
discovery response.

## 5.6 Job details and offer submission

For an authorized job, show task description, category, workplace media,
budget model, approximate location, schedule, permitted customer profile
information, and requirements.

An offer may contain proposed price/currency, proposed schedule, scope,
exclusions, message, and expiration.

Before saving, verify the provider is eligible, job is open, provider is
not the owner, no blocking/exclusion applies, offer limits are
respected, and terms are valid. Persist before notifying the customer.

## 5.7 Booking management

The ServMate dashboard should show pending offers, upcoming bookings,
active jobs, completed jobs, cancellations, and disputes where
supported.

The provider can update progress only through allowed state transitions.
If customer confirmation is required, do not allow the provider to
bypass it.

After completion, portfolio items can be published, but self-published
work must remain distinguishable from platform-verified jobs.

------------------------------------------------------------------------

# 6. PRIVATE CATEGORY-BASED JOB MATCHING

This is a release-critical rule.

## 6.1 Job publication flow

``` mermaid
flowchart TD
    A[Customer starts job post] --> B[Enter task and category]
    B --> C[Upload workplace media]
    C --> D[Set budget and price model]
    D --> E[Set location and schedule]
    E --> F[Review and publish]
    F --> G[Backend validates input]
    G --> H{Valid job?}
    H -- No --> I[Return validation errors]
    H -- Yes --> J[Persist job and media metadata]
    J --> K[Set eligible status]
    K --> L[Available only to matching ServMates]
```

## 6.2 ServMate discovery flow

``` mermaid
flowchart TD
    A[ServMate requests available jobs] --> B[Authenticate]
    B --> C{Provider capability enabled?}
    C -- No --> D[Deny provider feed access]
    C -- Yes --> E[Load structured service categories]
    E --> F[Match required job category]
    F --> G[Filter job status and publication state]
    G --> H[Apply block and exclusion rules]
    H --> I[Apply service-area and schedule rules]
    I --> J[Return authorized summaries]
```

## 6.3 Matching policy

A provider can discover a job only if: - Authenticated and authorized as
a ServMate. - Offers the required structured category or an explicitly
compatible subcategory. - Job is published, open, and discoverable. -
Provider is not the job owner. - No block or exclusion rule prevents
access. - Required service-area, schedule, and eligibility rules are
satisfied.

Default to exact category matching. If hierarchical or related-category
matching is used, document the exact policy and test it.

Changing a job category must immediately re-evaluate eligibility.
Existing offers and bookings should follow an explicit transition policy
rather than being silently deleted or invalidated.

## 6.4 Enforce on the backend

Protect all of the following: - Available-job feed. - Search and
filters. - Pagination and counts. - Job detail endpoints. - Job edits. -
Job offers. - Job media and thumbnails. - Notifications. - Realtime
events. - Job-related conversations. - Exports and administrative views.

Use reusable server-side authorization policies. Consider PostgreSQL
row-level security only if compatible with the existing architecture and
correctly configured for database roles, transactions, and connection
pooling.

Do not reveal the existence of an inaccessible job through error
messages, counts, pagination metadata, or other avoidable side channels.

------------------------------------------------------------------------

# 7. LOCATION AND PRIVACY FLOW

## 7.1 Location flow

1.  User enters an address manually or grants location permission.
2.  Client submits the chosen location through an appropriate
    authenticated request.
3.  Backend validates and normalizes it.
4.  Location is stored at the required precision and access level.
5.  Customer associates a service location with the job.
6.  Category eligibility is checked first.
7.  Service-area matching is applied to eligible providers.
8.  Discovery responses contain only appropriate approximate location
    data.
9.  Exact address is revealed only to authorized parties at the correct
    stage.

## 7.2 Location types to keep distinct

-   Private user address.
-   Optional public profile location.
-   ServMate service area.
-   Customer job location.
-   Booking-specific service address.

Do not automatically publish GPS coordinates just because a user grants
location permission.

Support a manual-location alternative. Let users correct their location
and control profile-location visibility.

For distance queries, evaluate PostGIS or another geospatial option if
justified. Otherwise, use a simpler city/municipality or service-area
model.

------------------------------------------------------------------------

# 8. MESSAGING REQUIREMENTS

Messaging supports private conversations between authorized customers
and ServMates.

Features may include: - Conversation inbox. - One-to-one messages. -
Text. - Image attachments. - Timestamps. - Read status and unread
counts. - Realtime delivery or documented polling. - Notification
preferences. - Blocking and reporting. - Search where appropriate.

A conversation may reference a job, offer, or booking. Only participants
and explicitly authorized system roles may access it.

Every read, send, attachment upload, download, edit, or delete operation
must validate permissions. Do not allow a user to subscribe to a guessed
realtime channel and receive private content.

Keep historical conversations according to retention policy even when
jobs close, while disabling actions that are no longer valid.

------------------------------------------------------------------------

# 9. OFFERS, PRICING, AND BOOKING STATE

A typical flow is:

`Job Open → Offer Submitted → Customer Reviews → Offer Accepted → Booking Confirmed → Work In Progress → Completion Requested → Completed`

Support rejection, withdrawal, cancellation, expiration, and dispute
states as required.

Possible job states: - Draft. - Open. - Offer Received. -
Accepted/Booked. - In Progress. - Completion Pending. - Completed. -
Cancelled. - Expired. - Disputed, if supported.

Define valid transitions, who may trigger them, preconditions, and
effects.

Do not assume that a single job can have multiple accepted providers
unless the product explicitly supports multi-provider work.

Use transactions and concurrency protection for offer acceptance,
booking creation, and state transitions.

Keep the customer's budget, provider's offer, and final agreed price as
distinct values.

Do not enable real-money payments or payouts until provider integration,
business rules, compliance, and security have been approved.

------------------------------------------------------------------------

# 10. COMPLETE DATA REQUIREMENTS

Inspect the current schema before changing it. The entities below are a
target logical model; reuse equivalent existing entities rather than
duplicating them.

## 10.1 Users and profiles

### `users`

-   `id`
-   `email` and/or `phone`, nullable according to auth method
-   normalized identifiers where required
-   `display_name`
-   `username`, if supported
-   `account_status`
-   verification timestamps
-   `created_at`
-   `updated_at`
-   `deleted_at`, where appropriate

### `user_profiles`

-   `user_id`
-   avatar reference
-   cover image reference
-   `bio`
-   optional public location label
-   profile visibility
-   timestamps

### Account capabilities

Represent customer and ServMate capabilities using the existing
authorization model or a normalized equivalent. Avoid redundant roles
without a clear purpose.

## 10.2 ServMate data

### `servmate_profiles`

-   `id`
-   `user_id`
-   professional bio
-   experience description
-   provider status
-   verification status, if applicable
-   service-area reference, if applicable
-   timestamps

### `service_categories`

-   `id`
-   `name`
-   `slug`
-   `description`
-   optional parent category
-   active flag
-   sort order
-   timestamps

### `servmate_categories`

-   ServMate profile reference
-   category reference
-   eligibility/approval status, if needed
-   timestamps
-   unique profile/category constraint

### `service_listings`

-   `id`
-   ServMate profile reference
-   category reference
-   title and description
-   pricing model
-   exact amount representation
-   currency
-   publication status
-   availability
-   timestamps and publication time

### `service_listing_media`

-   listing reference
-   media asset reference
-   display order
-   timestamp

## 10.3 Jobs and job media

### `job_posts`

-   `id`
-   customer user reference
-   required category reference
-   optional subcategory reference
-   title
-   description
-   job status
-   pricing model
-   budget amount and optional maximum
-   currency
-   service-location reference
-   preferred start/end timestamps
-   schedule flexibility
-   published and expiration timestamps
-   created/updated/closed timestamps

### `job_post_media`

-   job reference
-   media asset reference
-   optional caption
-   display order
-   timestamp

### History tables

Track important job state changes and material edits to budget,
schedule, category, and scope where necessary. Limit retained data to
what is operationally and legally justified.

## 10.4 Location data

### `locations`

-   `id`
-   owner reference where appropriate
-   location type
-   restricted address fields
-   barangay
-   city/municipality
-   province
-   postal code where applicable
-   restricted latitude/longitude where needed
-   timestamps

### `servmate_service_areas`

-   ServMate profile reference
-   area type
-   city/municipality and province where applicable
-   optional center coordinates and radius
-   timestamps

Separate public labels from exact address and coordinate fields. Apply
strict access control to precise location data.

## 10.5 Offers and counteroffers

### `job_offers`

-   `id`
-   job reference
-   ServMate profile reference
-   proposed amount
-   currency
-   proposed schedule
-   scope description
-   optional exclusions
-   offer status
-   optional expiration
-   timestamps

For counteroffers, use a revision/history model or another explicit
representation. Do not silently overwrite previously proposed or
accepted terms.

## 10.6 Bookings

### `bookings`

-   `id`
-   job reference
-   accepted offer reference
-   customer reference
-   ServMate reference
-   booking status
-   agreed amount and currency
-   agreed scope
-   agreed schedule
-   confirmed/started/completion/cancel timestamps
-   created/updated timestamps

Persist a snapshot of agreed commercial terms. Service listing edits
must not alter existing agreements.

### `booking_status_history`

Record old/new state, actor, timestamp, and reason where appropriate.

## 10.7 Conversations and messages

### `conversations`

-   `id`
-   conversation type
-   optional job reference
-   optional offer reference
-   optional booking reference
-   timestamps
-   last-message timestamp

### `conversation_participants`

-   conversation reference
-   user reference
-   joined timestamp
-   last-read timestamp
-   mute/status fields where supported
-   unique conversation/user constraint

### `messages`

-   `id`
-   conversation reference
-   sender user reference
-   message type
-   body, nullable for attachment-only messages
-   created/edited/deleted timestamps as supported

### `message_media`

-   message reference
-   media asset reference
-   timestamp

## 10.8 Media assets

### `media_assets`

-   `id`
-   owner user reference
-   storage key
-   media type
-   MIME type
-   file size
-   original filename only if needed
-   processing status
-   visibility classification
-   timestamps and deletion marker where appropriate

Store file bytes in appropriate object storage by default. Store
metadata and references in the database. Use private storage or
authorization-controlled delivery for private media.

## 10.9 Reviews and ratings

### `reviews`

-   `id`
-   booking reference
-   reviewer reference
-   reviewed ServMate profile reference
-   rating
-   optional comment
-   publication/moderation status
-   timestamps

Enforce review eligibility and the required uniqueness rule. Compute
ratings from eligible records or maintain a properly synchronized
aggregate.

## 10.10 Notifications

### `notifications`

-   `id`
-   recipient reference
-   notification type
-   optional job, offer, booking, or conversation reference
-   read timestamp
-   creation timestamp

### Delivery attempts

If required, track channel, attempt count, delivery status, and retry
schedule. Avoid storing sensitive payloads unnecessarily.

## 10.11 Blocks and reports

### `user_blocks`

-   blocker reference
-   blocked user reference
-   timestamp

### `user_reports`

-   `id`
-   reporter reference
-   optional reported user, job, or message reference
-   reason code
-   optional description
-   report status
-   creation/resolution timestamps

Restrict moderation records to authorized personnel and policies.

------------------------------------------------------------------------

# 11. DATA INTEGRITY AND VALIDATION

Apply appropriate: - Foreign keys. - Unique constraints. - Valid status
constraints. - Rating bounds. - Nonnegative/positive amount checks where
appropriate. - Currency validation. - Ownership relationships. - Review
eligibility rules. - Unique conversation participants. - Indexes for
common access paths. - Retention and deletion rules.

Validate at both API and database levels where appropriate.

Use transactions for: - Job publication and media association. - Offer
acceptance and booking creation. - Booking state changes. - Job closure
and offer invalidation. - Review eligibility and creation. -
Counteroffer acceptance.

Use database locks, constraints, idempotency keys, or equivalent
concurrency controls as appropriate.

The backend must derive the authenticated user's identity from the
trusted session/token, not a client-supplied user ID.

------------------------------------------------------------------------

# 12. API REQUIREMENTS

Adapt endpoint style to the existing architecture. These paths are
illustrative, not a requirement to introduce a new API pattern.

Potential API groups: - Authentication and current-user profile. -
ServMate profile and service listings. - Service category discovery. -
Customer job creation, editing, publishing, and management. - Private
eligible-job discovery. - Job offers and counteroffers. - Conversations,
messages, and attachments. - Bookings and status transitions. - Reviews
and reports. - Location and service-area management.

Examples: - `GET /users/me` - `PATCH /users/me` - `GET /servmates/:id` -
`PATCH /servmates/me` - `POST /servmates/me/services` -
`PATCH /servmates/me/services/:serviceId` - `POST /jobs` -
`GET /jobs/mine` - `GET /jobs/:jobId` - `PATCH /jobs/:jobId` -
`POST /jobs/:jobId/publish` - `GET /servmates/me/available-jobs` -
`GET /servmates/me/available-jobs/:jobId` - `POST /jobs/:jobId/offers` -
`POST /offers/:offerId/accept` - `GET /conversations` -
`GET /conversations/:conversationId/messages` -
`POST /conversations/:conversationId/messages` - `GET /bookings` -
`GET /bookings/:bookingId`

Every endpoint must have documented authentication, authorization,
validation, response shape, errors, pagination, and rate limits where
appropriate. Return consistent errors without leaking private resource
existence.

------------------------------------------------------------------------

# 13. FRONTEND SCREENS AND NAVIGATION

## 13.1 Customer navigation

Recommended primary areas: - Home. - Explore. - Post a Job. -
Messages. - Profile.

Bookings and job management must remain easy to find.

## 13.2 ServMate navigation

Recommended primary areas: - Home. - Available Jobs. - My Services. -
Messages. - Profile.

Bookings and work progress should be accessible from a clear
work-management area.

## 13.3 Customer screens

-   Authentication.
-   Marketplace home.
-   Service search and categories.
-   Service details.
-   ServMate profile.
-   Job creation wizard.
-   Media upload/preview.
-   Job review/publish.
-   My jobs.
-   Job details and offers.
-   Conversations.
-   Booking details.
-   Review submission.
-   Profile settings.

## 13.4 ServMate screens

-   Provider onboarding.
-   Profile editor.
-   Category selection.
-   Service listing editor.
-   Portfolio editor.
-   Available-jobs feed.
-   Restricted job details.
-   Offer creation/editing.
-   Messaging.
-   Booking dashboard.
-   Work progress/completion.
-   Reviews.
-   Service area and availability settings.

For every asynchronous screen, support loading, empty, error, success,
unauthorized, and retry states where relevant. Do not leave dead
buttons, fake success messages, or unimplemented placeholders disguised
as working features.

------------------------------------------------------------------------

# 14. SECURITY AND PRIVACY

Treat security as a core release requirement.

Review authentication, session handling, authorization, object
ownership, category-based job visibility, media access, messaging
membership, location privacy, rate limiting, input validation, upload
security, audit logs, user blocking/reporting, and data retention.

Test guessed IDs, direct API calls, unauthorized search filters, leaked
media URLs, and realtime subscription attempts.

Do not expose exact addresses or private workplace media to unrelated
providers. Do not log sensitive message content or credentials. Use
least-privilege database and storage permissions.

Review applicable Philippine data protection and other regulatory
requirements based on the actual business model. Escalate legal
uncertainties for qualified review rather than making unsupported
claims.

------------------------------------------------------------------------

# 15. DOCKER, KUBERNETES, AND DEVOPS

Inspect existing infrastructure first.

Where appropriate, provide: - Development and production-oriented
Dockerfiles. - Docker Compose for application dependencies. - Database
migration and seed commands. - Health checks and environment
templates. - Local Kubernetes testing using kind or an equivalent. -
Deployments, Services, configuration references, secret references,
resource requests/limits, probes, and local access configuration. -
Documented database strategy for local Kubernetes. - CI checks for lint,
typecheck, tests, builds, and security scanning.

Never commit real credentials. Do not claim local Kubernetes
configuration is production infrastructure without appropriate review.

------------------------------------------------------------------------

# 16. AUTOMATED TEST PLAN

## Customer tests

Verify registration, profile editing, job creation/editing, media
upload, category selection, budget and schedule validation, publication,
offer comparison, authorized messaging, booking access, completion,
reviews, and protection against viewing another customer's job.

## ServMate tests

Verify onboarding, category configuration, profile/service editing,
price updates, portfolio uploads, eligible job discovery, offer
submission, authorized messaging, booking management, and restrictions
against accessing other providers' resources.

## Critical privacy and matching tests

1.  A Cleaning ServMate can discover an eligible cleaning job.
2.  A Plumbing-only ServMate cannot discover the cleaning job.
3.  A nearby but category-ineligible provider cannot discover it.
4.  A visitor cannot retrieve private job details.
5.  An unrelated ServMate cannot retrieve a job by guessing its ID.
6.  An unrelated ServMate cannot retrieve job photos/videos or
    thumbnails.
7.  Category changes re-evaluate eligibility.
8.  Closed jobs disappear from active discovery.
9.  Blocking/exclusion rules prevent restricted access.
10. Nonparticipants cannot read private messages.
11. Nonparticipants cannot download message attachments.
12. Notifications do not disclose jobs to unrelated providers.
13. Concurrent offer acceptance cannot create conflicting bookings.
14. Service listing price changes do not alter confirmed booking terms.
15. Search, pagination, caches, exports, and realtime events preserve
    authorization.

Run actual available formatting, lint, typecheck, unit, integration,
API, end-to-end, migration, build, dependency, container, and Kubernetes
checks as feasible. Record actual outcomes and failures; never fabricate
test results.

------------------------------------------------------------------------

# 17. REQUIRED PROJECT DOCUMENTATION

Create or update appropriate files without duplicating existing
documents unnecessarily:

-   `docs/requirements/product-requirements.md`
-   `docs/requirements/functional-requirements.md`
-   `docs/requirements/data-requirements.md`
-   `docs/architecture/system-overview.md`
-   `docs/architecture/user-flows.md`
-   `docs/architecture/servmate-matching.md`
-   `docs/architecture/database-design.md`
-   `docs/architecture/api-design.md`
-   `docs/architecture/messaging-and-location.md`
-   `docs/security/access-control.md`
-   `docs/security/threat-model.md`
-   `docs/testing/testing-strategy.md`
-   `docs/operations/deployment.md`
-   `docs/operations/backup-and-recovery.md`
-   `docs/PROJECT_STATUS.md`
-   `docs/PROJECT_ROADMAP.md`
-   `docs/PROJECT_PROGRESS.md`

Documentation must match the actual implementation. Mark features as
planned, implemented, tested, blocked, or incomplete. Include Mermaid
diagrams for user journeys, matching, messaging, state transitions,
architecture, and deployment.

------------------------------------------------------------------------

# 18. IMPLEMENTATION PHASES

## Phase 1 --- Repository audit

Inspect source, docs, dependencies, configuration, Git status, tests,
and builds. Record the baseline.

## Phase 2 --- Requirements and data model

Map current features to this specification. Document data relationships,
user flows, state transitions, and authorization rules.

## Phase 3 --- Identity and capabilities

Verify authentication, customer capabilities, ServMate onboarding, and
permissions.

## Phase 4 --- Profiles and services

Implement profile management, structured categories, service listings,
pricing, and portfolios.

## Phase 5 --- Customer jobs

Implement job creation, media, category, budget, location, schedule,
editing, and lifecycle.

## Phase 6 --- Private matching

Implement category eligibility, backend authorization, service-area
rules, protected job details, and protected media.

## Phase 7 --- Offers and messaging

Implement offers, counteroffers if required, conversations, secure
attachments, notifications, and realtime/polling delivery.

## Phase 8 --- Bookings and reviews

Implement transactional offer acceptance, booking snapshots, state
transitions, completion, and eligible reviews.

## Phase 9 --- UI/UX

Complete responsive marketplace screens, consistent design,
accessibility, and all loading/error/empty states.

## Phase 10 --- Verification and deployment

Run regression/security tests, builds, Docker checks, and Kubernetes
tests where configured. Update all documentation.

After each phase, update `docs/PROJECT_PROGRESS.md` with: - Completed
tasks. - Files created/modified. - Commands executed and actual
results. - Known failures. - Remaining blockers. - Next actions.

Do not rewrite the entire codebase in one uncontrolled operation. Make
changes in small, reviewable batches.

------------------------------------------------------------------------

# 19. FINAL DELIVERABLES AND REPORT

At completion, report: 1. Original project condition and baseline. 2.
Existing versus missing features. 3. Architecture changes and rationale.
4. Customer and ServMate flows implemented. 5. Data model and migration
changes. 6. Category-based privacy controls. 7. Messaging and location
implementation. 8. Files created, modified, and deleted. 9. Security
issues found and resolved. 10. Actual tests, builds, linting, and
typecheck results. 11. Docker/Kubernetes setup instructions. 12.
External dependencies and manual configuration. 13. Remaining defects,
assumptions, and blockers. 14. Prioritized roadmap. 15. Evidence-based
release-readiness assessment.

Do not claim production readiness merely because the UI looks complete
or the application builds.

------------------------------------------------------------------------

# 20. START NOW

Inspect the existing ServEm repository and documentation. Establish the
baseline and compare the actual implementation against this
specification.

Create the audit, detailed Customer flow, detailed ServMate flow,
private category-matching flow, messaging flow, location flow, data
requirements, database design, API plan, and prioritized implementation
roadmap.

Then implement the project-wide improvements incrementally and test
them.

**The goal is a coherent, secure, maintainable ServEm marketplace in
which the UI, backend, database, access-control rules, and documentation
all implement the same business requirements.**
