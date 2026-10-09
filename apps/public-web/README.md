# ServEm public website

Responsive Next.js public marketplace interface based on the ServEm production blueprint.

## Run locally

1. Select the repository package manager and create its lockfile after closing decision D-004 in `../../sidehustle_marketplace_blueprint_v3/docs/DECISION_REGISTER.md`.
2. Install the dependencies in this directory with the selected package manager.
3. Start the site with that manager's `dev` script.

Without `API_BASE_URL`, a development run displays clearly marked synthetic design-preview listings. In production, an unset API URL shows an unavailable-catalog state and does not show sample listings.

To connect the public catalog, copy `.env.example` to `.env.local` and replace the placeholder with the API root ending in `/api/v1`. The website only calls `GET /services`, with a 20-item limit. No API secret belongs in the browser or this file.

## Current scope and blueprint gates

- Search, pricing filters, sorting, refresh, service summaries, FAQ disclosures, mobile navigation, and service details are interactive.
- The preview request form is local UI only. It never sends or stores a booking. Live catalog mode explains that secure sign-in and approved booking policies must be connected before requests can be submitted.
- The current OpenAPI starter does not define service details, categories, provider public profiles, or the rest of the account/help/policy flows. The interface does not invent those data or permissions.
- OIDC, age/category eligibility, booking terms, and deletion policies remain open decisions. Keep user, provider, and payment actions gated until those decisions and server endpoints are implemented.
- This checkout does not include the API. Live catalog mode requires a separately running API at `API_BASE_URL`.
