# ServEm Web + Admin

TypeScript recreation of the **ServEm Web** and **ServEm Admin Dashboard** design boards in
`../ServEm/ServEm_Web-Design` and `../ServEm/ServEm_Admin-Dashboard`, wired to Firebase.

- React 19 + TypeScript + Vite
- Tailwind CSS v4 with the design tokens lifted from the boards
- React Router for every screen
- Firebase Auth (email/password + Google) and Cloud Firestore
- Inter and the photography extracted from the design files (`public/assets`)

## Run

```bash
npm install
npm run dev        # http://localhost:5180
npm run build      # production bundle in dist/
npm run lint
npx tsc --noEmit -p tsconfig.app.json
```

The app opens on the Welcome screen with a full demo dataset. Create an account (or log in)
to switch the customer data to Firestore; everything else keeps working offline because the
repositories fall back to seeded example data.

## Routes

| Area | Routes |
| --- | --- |
| Auth | `/`, `/signup`, `/login`, `/reset`, `/verify`, `/role` |
| Customer | `/app/home`, `/app/explore`, `/app/categories`, `/app/categories/:category`, `/app/search`, `/app/services/:id`, `/app/servmates/:id`, `/app/saved` |
| Booking | `/app/book/:serviceId/date`, `/address`, `/location`, `/review`, `/app/book/sent/:bookingId` |
| Bookings | `/app/bookings`, `/app/bookings/:id`, `.../reschedule`, `.../cancel`, `.../complete`, `.../review`, `.../review/sent` |
| Account | `/app/messages`, `/app/messages/:id`, `/app/notifications`, `/app/profile`, `/app/profile/info`, `/app/profile/places`, `/app/settings`, `/app/help` |
| ServMate | `/mate` (dashboard), `apply`, `setup`, `verify`, `profile`, `services`, `services/new`, `services/:id/edit`, `hours`, `area`, `requests`, `requests/:id`, `jobs`, `jobs/:id`, `jobs/:id/en-route`, `jobs/:id/updates`, `jobs/:id/wrap-up`, `jobs/:id/cancelled`, `jobs/:id/new-time`, `messages`, `updates`, `earnings`, `earnings/withdraw`, `reviews`, `account` |
| Admin | `/admin` (overview), `customers`, `customers/:id`, `servmates`, `servmates/:id`, `verification`, `verification/:id`, `catalog`, `catalog/:id`, `categories`, `bookings`, `bookings/:id`, `payments`, `payments/:id`, `payments/:id/refund`, `payouts`, `payouts/:id`, `disputes`, `disputes/:id`, `tickets`, `tickets/:id`, `reviews`, `analytics`, `communications`, `campaigns/new`, `settings`, `team`, `audit` |
| States | `/states` — loading, empty, offline, error, payment, verification, validation and admin outcomes |

## Firebase

Copy the environment template and fill it from **Firebase console → Project settings →
Your apps → Web app → SDK setup and configuration**:

```bash
cp .env.example .env
```

The web config is public by design (it ships in every browser bundle); access is enforced by
Firestore and Storage rules. Restrict the browser API key to the Hosting origins and localhost,
and enable Firebase App Check before launch. Do not commit `.env`.

Then in the Firebase console for `servem-ph`:

1. **Authentication → Sign-in method**: enable **Email/Password** and **Google**.
   Add `localhost` to **Authentication → Settings → Authorized domains** for local development.
2. **Firestore Database**: create the database, then deploy the bundled rules and indexes:

   ```bash
   npm i -g firebase-tools   # once
   firebase login
   firebase deploy --only firestore:rules,firestore:indexes --project servem-ph
   ```

3. **Admin access**: set a custom claim on the admin account, for example with the Admin SDK
   (`adminAuth.setCustomUserClaims(uid, { admin: true })`), then sign in again. The rules let
   `admin == true` read/write the operations collections.
4. **Hosting (optional)**: `npm run build && firebase deploy --only hosting --project servem-ph`.

### Data model

| Collection | Document | Written by |
| --- | --- | --- |
| `profiles/{uid}` | Profile fields | the signed-in user |
| `profiles/{uid}/places/{placeId}` | Saved address | the signed-in user |
| `bookings/{bookingId}` | Booking + `customerId` | customer; status updates by customer/admin |
| `threads/{threadId}` | `members[]`, `messages[]` | thread members |
| `notifications/{id}` | Notification + `uid` | admin |
| `services`, `servmates`, `reviews` | public catalog | admin |
| `customers`, `payments`, `payouts`, `disputes`, `tickets`, `auditLog` | operations data | admin |

`firestore.rules` is least-privilege by default. The admin dashboard currently renders the
seeded operations example data — the admin board is an "Example data" operations suite — and
`src/lib/db.ts` exposes `fetchAdminCollection()` for swapping those tables to Firestore.

### Demo behavior

`src/state/AppState.tsx` owns the session, bookings, threads, saved places, notifications and
favorites. It subscribes to Firebase Auth; when signed out, or when a Firestore read is rejected
by rules, it keeps the local dataset and persists interactions to `localStorage` under
`servem.web.demo.v1`. That is why every screen is explorable before Firebase is configured.

Payment, payout, verification, messaging delivery and location are simulated, exactly as the
design boards state. No real card is charged and no money moves.

## Structure

```
src/
  components/     design system, site header, Mate/Admin shells, cards, admin widgets
  data/seed.ts    every example record used by the screens
  lib/            Firebase init, Firestore repository, domain types
  pages/          auth, customer, booking, servmate, admin, states
  state/          AppState provider (session + data ownership)
  styles.css      tokens and component styles lifted from the boards
```

## Design fidelity

- Canvas: 1280 px browser frame, 40 px gutters, 94 px customer header, 224 px workspace rails.
- Palette: `#F7FAF8` page, `#FFFFFF` surface, `#E5F5EC` soft green, `#16845B` action green,
  `#0B573D` brand ink, `#DFE8E2` lines, `#172B22` text.
- Type: Inter with the board's sizes and tight letter-spacing; section titles 19 px, page
  titles 34 px, body 12–14 px.
- Assets: `public/assets/photos` and `public/assets/fonts` are extracted from the design files,
  not stock placeholders.
