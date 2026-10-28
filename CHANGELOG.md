# Changelog

Artifacts are published on the [releases page](https://github.com/nexonsabanao/ServEm/releases).
Dates are the publish date of the artifact, not of the source tree.

## v1.0.0-android — 26 October 2026

First published Android build. Prototype, sideload only.

- **Artifact:** `ServEm.apk`, 58,265,107 bytes, sha256
  `f4f0f25522f2119618659c08e8d28453fd05897575b700494f09dfbc830b8ba7`, signed with the debug keystore
  (see README, "Android").
- **App:** version `1.0.0` (versionCode `1`), minSdk 24, target SDK 36, universal APK.
- **Accounts:** email/password and Google sign-in; email verification; suspended accounts are told
  what is paused instead of failing writes silently.
- **Customer:** catalogue, service and ServMate profiles, booking wizard, bookings list,
  messaging, saved places, notifications.
- **ServMate:** dashboard, listing editor, requests, job updates, earnings and payout requests.
- **Staff:** console screen for verification, withdrawal and dispute decisions.
- **Known gaps:** no payment processing, no iOS build, no deployed Cloud Functions. See
  [PRODUCTION_ROADMAP.md](PRODUCTION_ROADMAP.md).

## Web — Firebase Hosting (`servem-ph.web.app`)

Hosting is redeployed from `main`; the current bundle is described in the README rather than
versioned here.
