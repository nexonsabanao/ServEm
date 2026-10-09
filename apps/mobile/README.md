# ServEm mobile app

Flutter app foundation for Android and iOS. The current slice implements public service discovery against `GET /api/v1/services` and loading, empty, configuration, network, and API error states.

## Run

Configure the API base URL at build/run time. Use the API root including `/api/v1`:

```sh
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
```

For an iOS simulator, use the host address reachable from that simulator (commonly `http://127.0.0.1:3000/api/v1`). Do not put credentials or secrets in `--dart-define`; values compiled into a mobile app are public.

## Blueprint alignment and current limits

- Visual tokens: off-white `#F6F5F1`, graphite `#4A4A4A`, mist `#CBCBCB`, and slate `#6D8196`; the hero uses a darker slate tint for accessible light-on-dark copy.
- Flutter/Dart, feature-first API/data and UI boundaries, one client for both mobile platforms.
- Catalog reads use the public `/services` contract, bounded to 20 results. The UI does not derive provider identity or authorization from service IDs.
- The service summary model is handwritten against the partial starter schema; switch to generated client types when the OpenAPI contract is complete and code generation is selected.
- The starter contract marks `/services` as public, while the product flow says anonymous browsing needs an explicit decision. Confirm that policy before beta.
- No tokens, identity documents, payment details, or credentials are stored by this slice.
- Booking and account tabs are informational until OIDC and account policies are selected. There is no client-side role switch or simulated account.
- The OpenAPI starter does not yet define service detail, categories, provider public profile, bookings list, or messaging routes. Those screens and actions need approved contracts before implementation.
- This checkout does not include an API or the Flutter SDK/platform project templates, so the app cannot yet be run end-to-end here. The source is ready to be opened by Flutter tooling once the SDK is installed; Android/iOS runner targets still need to be generated with Flutter tooling.

Open decisions that gate the next mobile slices are recorded in the blueprint's `docs/DECISION_REGISTER.md`, especially D-004, D-006, D-008 through D-012, and D-018/D-019.
