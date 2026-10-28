# ServEm PH — setup and run instructions

ServEm is a Philippine neighbourhood-services marketplace: customers book verified ServMates for
cleaning, repairs, assembly, errands and similar help, ServMates run their own workspace, and a
staff console handles moderation, verification, finance and support.

```text
servem_web/     TypeScript + React web app (customer site, ServMate workspace, admin console)
servem_app/     Flutter mobile app (customer + ServMate, same backend)
tools/          Repo-level audit scripts
```

Both clients talk to one Firebase project:

```text
Project: servem-ph   Number: 734357679797
Web app:  1:734357679797:web:d041ece4f0904bebe098fc
Region:   Asia/Manila; Firestore in asia-northeast1
Billing:  Spark (free) — no Cloud Functions deployed
Currency: Philippine peso (₱), 10% platform service fee enforced by firestore.rules
```

The Firebase **web config is public by design** — it ships inside every web bundle and grants
nothing by itself. Access is enforced by `firestore.rules` and `storage.rules`, which re-check
ownership, frozen money fields and status transitions on every client write. The `functions/`
source is kept for a future paid plan but **no Cloud Functions are deployed** on the free plan.
Service-account keys, admin tokens and payment secrets are **never** client values; they stay
outside the repo and are only used by local admin tooling such as the seeder.

---

## 1. Prerequisites

| Tool | Version |
| --- | --- |
| Node.js | 22+ |
| Firebase CLI | `npm i -g firebase-tools` |
| Java (for the Firestore emulator) | 17+ |
| Flutter | 3.35+ with macOS/iOS/Android toolchains as needed |

```bash
firebase login
```

---

## 2. Enable the Firebase project once

In the [Firebase console](https://console.firebase.google.com/project/servem-ph) for `servem-ph`:

1. **Authentication → Sign-in method**: enable **Email/Password** and **Google**. Add `localhost`
   under **Authorized domains**, and your real domain when you have one.
2. **Apple sign-in (optional)**: enable **Apple** in the same list, then paste the **Services ID**
   and the **Apple team / key / key ID** from an Apple Developer account. The button is already in
   the UI (`signInWithApple` → `OAuthProvider('apple.com')`); until the provider is enabled, a click
   shows "That sign-in method is not enabled for ServEm yet" instead of failing silently. Sign in
   with Apple on a web service ID requires the paid Apple Developer Program — that cost is Apple's,
   not Firebase's.
3. **Firestore Database**: create in **production mode**, region `asia-northeast1` or the closest
   available to the Philippines.
4. **Storage**: enable (the profile-photo and verification paths are defined in `storage.rules`).
5. **Billing**: stay on **Spark**. No Cloud Functions are deployed, so no Blaze plan is needed.

## 3. Web app

```bash
cd servem_web
cp .env.example .env      # public config only; edit if you use another project
npm install
npm run dev               # http://localhost:5180
```

Routes: `/` marketing and sign-in, `/app/*` customer workspace, `/mate/*` ServMate workspace,
`/admin/*` staff console, `/terms` and `/privacy` legal documents. `/app/*` and `/mate/*` require a
signed-in session; `/admin/*` additionally requires the `admin` custom claim, and refuses to render
without it.

Type-check, lint and build:

```bash
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build             # emits dist/
```

## 4. Backend: rules, indexes and direct writes

ServEm runs on Firebase's free **Spark** plan, so this project deploys **no Cloud Functions**.
Client writes go straight to Firestore, and `servem_web/firestore.rules` is the enforcement layer:
it pins the actor, the fields each transition may touch, the listing's own rate, the 10% platform
fee and the total on every write. Deploy the rules, indexes and storage; skip the functions step.

```bash
cd servem_web
firebase deploy --only firestore:rules,firestore:indexes,storage --project servem-ph
firebase deploy --only hosting --project servem-ph
```

`functions/` stays in the repo as the future server-side home for these operations — signed payment
webhooks cannot exist without it. It is not built, deployed or called today, so Blaze billing is
not required.

What the rules enforce on the free plan:

- a booking is created only for the customer's own uid, against a **live** listing, at that
  listing's own `rate`, with `fee` within one peso of 10% of `rate × hours` and
  `total == rate × hours + fee`;
- participants move a booking only along the published transitions, and rate, fee, total, hours,
  service and both parties are frozen after creation;
- messages are authored by the sender and readable only by the thread's two participants;
- verification documents, withdrawals, disputes and tickets are created by their owner with a
  pending/open status; only an `admin` claim can decide them, and every decision appends to `audit`;
- payments, payouts, webhook ledgers and rate-limit counters have no client write path at all.

Payment integration is deliberately inert without Functions: `paymentProviderWebhook` and
`PAYMENT_WEBHOOK_SECRET` exist only in source, and no screen claims money has moved.

Local emulator loop — Auth and Firestore, no Blaze plan:

```bash
# The Firestore/Storage emulators run on Java. If `java` is not on your PATH,
# point JAVA_HOME at a JDK (Android Studio ships one):
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"

cd servem_web
firebase emulators:start --only auth,firestore --project servem-ph

# in a second shell: point the app at the emulators, then sign up in the app
VITE_USE_FIREBASE_EMULATOR=1 npm run dev
```

`VITE_USE_FIREBASE_EMULATOR` defaults to off, so production builds always talk to `servem-ph`.
The emulators start empty — create an account through the app, then seed listings against them
with the catalogue tool (it detects `FIRESTORE_EMULATOR_HOST` and skips credentials):

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
  node servem_web/tools/seed-catalogue.mjs --provider-email you@example.com --role servmate
```

### Granting the first admin

There is no client path to the `admin` claim, by design. Grant it once from a trusted machine:

1. Firebase console → **Authentication** → Users → your account → **Custom claims**, set
   `{"admin": true}`; or
2. with a service-account key held **outside** the repo:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/secure/path/service-account.json \
  node -e "const a=require('firebase-admin');a.initializeApp({projectId:'servem-ph'});a.auth().setCustomUserClaims('<uid>',{admin:true}).then(()=>console.log('granted'))"
```

Sign out and back in so the new claim is inside the ID token.

### Seeding the launch catalogue

`services` and `servmates` are readable according to their status, and a ServMate may publish or
pause **their own** listing; the launch catalogue is still bulk-loaded by script rather than from
the browser:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/secure/servem-admin.json   # held outside the repo
node servem_web/tools/seed-catalogue.mjs \
  --project servem-ph \
  --provider-email provider@example.com \
  --role servmate          # also opens the ServMate workspace for that profile
```

Use `--dry-run` to print the documents first. The tool needs the provider to have signed up
already, writes deterministic ids (re-running merges instead of duplicating), and never contains
credentials itself.

## 5. Mobile app

```bash
cd servem_app
flutter pub get
flutter run -d chrome      # works immediately: the web Firebase config is compiled in
```

Native builds need their own app registrations (only the web config was supplied):

1. **Project settings → Add app → Android**, package `com.servem.servem_app`, drop
   `google-services.json` into `android/app/`.
2. **Add app → iOS**, bundle `com.servem.servemApp`, drop `GoogleService-Info.plist` into
   `ios/Runner/`.
3. Or regenerate all of it: `flutterfire configure --project=servem-ph`.
4. Native builds read the generated plugin files; no API key or app ID is passed on the command line.

5. **Android Google sign-in needs the signing certificate's SHA fingerprints on the Firebase
   Android app.** Without the SHA-1, Google sign-in fails with `DEVELOPER_ERROR` / "no matching
   client found". The debug keystore used for the current release build is already registered;
   any new keystore (a real upload key, or a build on another machine) must be added too:

```bash
APP=1:734357679797:android:0bc099e22ab53fdde098fc

# Print the fingerprints of the keystore that signs the APK
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
"$JAVA_HOME/bin/keytool" -list -v -keystore ~/.android/debug.keystore \
  -alias androiddebugkey -storepass android -keypass android | grep -E "SHA1:|SHA256:"

# Register both, then regenerate the client config the build reads
firebase apps:android:sha:list   "$APP" --project servem-ph
firebase apps:android:sha:create "$APP" "93:72:68:70:66:4C:6A:5A:F7:DA:83:DA:61:AF:35:EA:F8:0D:F8:FA" --project servem-ph
firebase apps:android:sha:create "$APP" "0D:1A:DF:FD:A4:F9:86:EB:F4:EE:40:44:16:7C:E7:FC:98:E4:03:9D:FE:1D:7D:39:8B:F9:61:14:D3:96:A9:1A" --project servem-ph
firebase apps:sdkconfig ANDROID "$APP" --project servem-ph --out android/app/google-services.json
```

The regenerated `google-services.json` contains the Android OAuth client
(`client_type: 1`, `certificate_hash` = the SHA-1). It is gitignored; every developer and CI
machine needs their own copy.

The mobile app starts from the real auth state: signed out goes to login/signup, signed in reads
its own Firestore data, and the staff surfaces are gated on the same `admin` claim. It calls the
same Cloud Functions, so a booking made on a phone appears immediately in the web admin console.

```bash
flutter analyze
flutter test
```

## 6. Data model

```text
profiles/{uid}                    name, email, phone, city, role, photo, verified
profiles/{uid}/places/{placeId}   label, address, isDefault
services/{id}                     public catalogue; admin-written only
servmates/{id}                    public provider profile; admin-written only
bookings/{id}                     customerId, providerId, service, date, time, hours, status,
                                  address, notes, rate, fee, total, server timestamps
threads/{id}                      members[], messages[], updatedAt
notifications/{id}                uid, title, body, kind, read
verificationRequests/{id}         storage paths (never public URLs), status, decidedBy
payments/{id} payouts/{id} withdrawals/{id}     settlement records, function-written only
disputes/{id} tickets/{id} reviews/{id}         trust-and-safety records
audit/{id}                        actor, action, reason, timestamp — append only, never mutated
webhookEvents/{id}                payment provider event ids, for idempotent delivery
rateLimits/{uid}                  booking-creation throttle counters
```

`firestore.rules` matches `/audit/{entryId}` with client reads and writes denied, and every
privileged function writes there through the Admin SDK. A grant or admin decision that does not
appear in `audit` did not happen.

## 7. Verifying a checkout

```bash
node tools/production-audit.mjs      # demo copy, US leftovers, dead links, client-side money writes,
                                     # undeployed callables, unruled collections, payload drift, dead imports
cd servem_web && npm run build && npm run lint
cd functions && npm run typecheck
cd ../.. && cd servem_app && flutter analyze && flutter test
```

The audit exits non-zero while any finding remains, so it is safe to wire into CI as-is.

## 8. Troubleshooting

- **`Missing or insufficient permissions`** — the rules are doing their job. Either they were not
  deployed to the project you are pointing at, or the write broke one of their checks: a booking
  against a non-live listing, a fee that is not 10% of `rate × hours`, a status transition the UI
  does not expose, or a field that is frozen after creation.
- **Admin console says access restricted** — the claim lives in the ID token, not the database.
  Grant it as described in §4, then sign out and back in.
- **`not enabled for ServEm yet` on Apple** — enable the Apple provider in Firebase Authentication
  and add the Apple Services ID; the button never fakes a session.
- **Google sign-in popup closes immediately** — the origin is not in **Authorized domains**.
- **Emulator starts but the app looks empty** — the emulator is a separate, empty database; run
  the catalogue seed against the emulator project.
