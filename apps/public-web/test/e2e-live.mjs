/**
 * ServEm end-to-end check: post a job, let two eligible ServMates discover and
 * bid on it (including after the first offer arrives), confirm the ineligible
 * ones cannot, then compare and accept.
 *
 * This is the half of the proof that `npm test` cannot give: it drives the real
 * HTTP surface of a running server, with real sessions in cookies. Run it in two
 * steps:
 *
 *   SERVEM_DATA_DIR=$(mktemp -d) npm run dev -- --port 3100   # terminal one
 *   npm run test:e2e                                          # terminal two
 *
 * Pointing SERVEM_DATA_DIR at a scratch directory keeps the throwaway accounts
 * this script signs up out of the development store. Exits non-zero if any check
 * fails.
 *
 * The suite itself spends quota: six sign-ups and up to eight recovery
 * requests per run. The shipped caps allow about six runs per hour against one
 * server. For a long test session start the dev server with looser buckets on
 * those two — but leave the per-address+email recovery pair at its shipped
 * quota, which is what the 429 check below trips:
 *
 *   SERVEM_RATE_LIMIT_SIGNUP=200/60 SERVEM_RATE_LIMIT_PASSWORDRESETPERADDRESS=500/60
 */
const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';

let failures = 0;
function check(name, condition, detail) {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
}

function newJar() {
  return { cookie: '' };
}

async function call(jar, method, path, body) {
  const headers = { Origin: BASE, Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (jar.cookie) headers.Cookie = jar.cookie;
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  const setCookie = response.headers.getSetCookie?.() ?? [];
  mergeCookies(jar, setCookie);
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  return { status: response.status, body: payload, setCookie: setCookie.join(' | ') };
}

/**
 * Keeps a jar's cookie header current.
 *
 * Two cookies matter here: the account session, and the moderation console's own
 * credential — which is deliberately not the session and is why this merges by
 * name rather than replacing the header wholesale. A cleared cookie arrives as an
 * empty value and is merged as one, so a locked console really does stop sending
 * a usable credential.
 */
function mergeCookies(jar, setCookieList) {
  const pairs = new Map();
  for (const part of jar.cookie.split('; ').filter(Boolean)) {
    const name = part.split('=')[0];
    pairs.set(name, part.slice(name.length + 1));
  }
  for (const raw of setCookieList) {
    const pair = raw.split(';')[0] ?? '';
    const name = pair.split('=')[0] ?? '';
    if (!name.startsWith('servem_')) continue;
    pairs.set(name, pair.slice(name.length + 1));
  }
  jar.cookie = [...pairs].map(([name, value]) => `${name}=${value}`).join('; ');
}

async function signup(jar, name, email) {
  const result = await call(jar, 'POST', '/api/auth/signup', {
    name,
    email,
    password: 'e2e-password-123',
  });
  if (result.status !== 200 && result.status !== 201) {
    throw new Error(`signup ${email} failed: ${result.status} ${JSON.stringify(result.body)}`);
  }
  return result.body.account.id;
}

async function onboard(jar, categories, areas) {
  const created = await call(jar, 'POST', '/api/servmate/onboard', {});
  if (created.status !== 201 && created.status !== 200) {
    throw new Error(`onboard failed: ${created.status} ${JSON.stringify(created.body)}`);
  }
  const categoriesResult = await call(jar, 'PUT', '/api/servmate/me/categories', {
    categoryIds: categories,
  });
  if (categoriesResult.status !== 200) {
    throw new Error(`categories failed: ${categoriesResult.status} ${JSON.stringify(categoriesResult.body)}`);
  }
  const areasResult = await call(jar, 'PUT', '/api/servmate/me/coverage', { areas });
  if (areasResult.status !== 200) {
    throw new Error(`coverage failed: ${areasResult.status} ${JSON.stringify(areasResult.body)}`);
  }
  return created.body.servmateProfileId;
}

const ids = (list) => list.map((job) => job.id);

/* ---------------------------------------------------------------- *
 * 1. Accounts
 * ---------------------------------------------------------------- */
const customer = newJar();
const clean1 = newJar();
const clean2 = newJar();
const repairOnly = newJar();
const farAway = newJar();
const latecomer = newJar();

const stamp = Date.now();
const customerId = await signup(customer, 'E2E Customer', `customer-${stamp}@e2e.test`);
await signup(clean1, 'Cleaner One', `clean1-${stamp}@e2e.test`);
const clean2Id = await signup(clean2, 'Cleaner Two', `clean2-${stamp}@e2e.test`);
await signup(repairOnly, 'Repair Only', `repair-${stamp}@e2e.test`);
await signup(farAway, 'Far Away Cleaning', `far-${stamp}@e2e.test`);
await signup(latecomer, 'Late Cleaner', `late-${stamp}@e2e.test`);
console.log('· six accounts created');

/* ---------------------------------------------------------------- *
 * 2. Provider capability: two eligible, two not, one later
 * ---------------------------------------------------------------- */
await onboard(clean1, ['cleaning'], ['Bacoor']);
await onboard(clean2, ['cleaning'], ['Bacoor']);
await onboard(repairOnly, ['home-repair'], ['Bacoor']);
await onboard(farAway, ['cleaning'], ['Tagaytay']);
await onboard(latecomer, ['cleaning'], ['Bacoor']);
console.log('· five providers onboarded');

/* ---------------------------------------------------------------- *
 * 3. The customer posts and publishes a job
 * ---------------------------------------------------------------- */
const start = new Date(Date.now() + 3 * 86_400_000).toISOString();
const jobTitle = 'Deep clean for a two-bedroom condo';
const created = await call(customer, 'POST', '/api/jobs', {
  title: jobTitle,
  description: 'Kitchen, two bathrooms, living room and both bedrooms, including the balcony.',
  categoryId: 'cleaning',
  pricingModel: 'fixed',
  budgetCentavos: 180000,
  locationCity: 'Bacoor',
  locationBarangay: 'Molino IV',
  locationNotes: 'Gate code 1234, unit 4B. Ask for the owner at the guardhouse.',
  preferredStart: start,
  scheduleFlexible: true,
});
check('the customer can create a job post', created.status === 201, created);
const jobId = created.body?.job?.id;
const job = created.body?.job;
check('the new job starts as a draft', job?.jobStatus === 'draft', job?.jobStatus);
check(
  'job creation echoes the whole stored record',
  job?.currency === 'PHP' && job?.budgetCentavos === 180000 && job?.categoryId === 'cleaning',
  job,
);

const validation = await call(customer, 'POST', '/api/jobs', {
  title: '',
  description: '',
  categoryId: 'not-a-category',
  pricingModel: 'hourly',
  budgetCentavos: 12.5,
  locationCity: 'Cebu',
});
check('a bad job post is refused with field errors', validation.status === 400, validation);
check(
  'validation names each bad field',
  validation.body?.errors?.title &&
    validation.body?.errors?.categoryId &&
    validation.body?.errors?.budgetCentavos &&
    validation.body?.errors?.locationCity,
  validation.body?.errors,
);

const published = await call(customer, 'POST', `/api/jobs/${jobId}/publish`);
check('the customer can publish the job', published.status === 200, published);
check('publishing opens the job for discovery', published.body?.job?.jobStatus === 'open', published.body?.job?.jobStatus);
check('publishing sets an expiry', typeof published.body?.job?.expiresAt === 'string');

/* ---------------------------------------------------------------- *
 * 4. Eligible providers discover it; the others do not
 * ---------------------------------------------------------------- */
const feed1 = await call(clean1, 'GET', '/api/servmate/me/available-jobs');
check('an eligible ServMate sees the job', ids(feed1.body?.jobs ?? []).includes(jobId), feed1.body);

const feedRepair = await call(repairOnly, 'GET', '/api/servmate/me/available-jobs');
check(
  'a repair-only ServMate does not see the cleaning job',
  !ids(feedRepair.body?.jobs ?? []).includes(jobId),
  feedRepair.body,
);

const feedFar = await call(farAway, 'GET', '/api/servmate/me/available-jobs');
check(
  'a cleaning ServMate outside the coverage area does not see it',
  !ids(feedFar.body?.jobs ?? []).includes(jobId),
  feedFar.body,
);

const detailEligible = await call(clean1, 'GET', `/api/servmate/me/available-jobs/${jobId}`);
check('an eligible ServMate gets the full job', detailEligible.status === 200, detailEligible);
check(
  'the full job carries the barangay and the access notes',
  detailEligible.body?.job?.locationBarangay === 'Molino IV' &&
    detailEligible.body?.job?.locationNotes?.includes('Gate code 1234'),
  detailEligible.body?.job,
);

const feedSummary = feed1.body?.jobs?.find((entry) => entry.id === jobId);
check(
  'the discovery summary withholds the exact address',
  feedSummary && !('locationBarangay' in feedSummary) && !('locationNotes' in feedSummary),
  feedSummary,
);

const detailIneligible = await call(repairOnly, 'GET', `/api/servmate/me/available-jobs/${jobId}`);
check('an ineligible ServMate is refused the detail', detailIneligible.status === 404, detailIneligible);
const detailFar = await call(farAway, 'GET', `/api/servmate/me/available-jobs/${jobId}`);
check('a provider outside the area is refused the detail', detailFar.status === 404, detailFar);

const detailGuessed = await call(repairOnly, 'GET', '/api/servmate/me/available-jobs/does-not-exist');
check(
  'a guessed id answers exactly like a forbidden one',
  detailGuessed.status === detailIneligible.status &&
    JSON.stringify(detailGuessed.body) === JSON.stringify(detailIneligible.body),
  { guessed: detailGuessed.body, forbidden: detailIneligible.body },
);

/* ---------------------------------------------------------------- *
 * 5. The first offer must not hide the job from anyone else
 * ---------------------------------------------------------------- */
const offer1 = await call(clean1, 'POST', `/api/servmate/me/available-jobs/${jobId}/offers`, {
  amountCentavos: 175000,
  scopeDescription: 'Full deep clean with supplies included.',
  message: 'Available this Saturday morning.',
});
check('the first ServMate can offer', offer1.status === 201, offer1);
check('the first offer is pending', offer1.body?.offer?.offerStatus === 'pending', offer1.body?.offer);

const afterFirstOffer = await call(customer, 'GET', `/api/jobs/${jobId}`);
check(
  'the job is now marked as having received an offer',
  afterFirstOffer.body?.job?.jobStatus === 'offer_received',
  afterFirstOffer.body?.job?.jobStatus,
);

const feed2 = await call(clean2, 'GET', '/api/servmate/me/available-jobs');
check(
  'REGRESSION: a job with an offer is still discoverable by a second ServMate',
  ids(feed2.body?.jobs ?? []).includes(jobId),
  feed2.body,
);

const detail2 = await call(clean2, 'GET', `/api/servmate/me/available-jobs/${jobId}`);
check('the second ServMate can open the job', detail2.status === 200, detail2.status);

const offer2 = await call(clean2, 'POST', `/api/servmate/me/available-jobs/${jobId}/offers`, {
  amountCentavos: 165000,
  scopeDescription: 'Deep clean, team of two.',
});
check('the second ServMate can offer on the same job', offer2.status === 201, offer2);

const duplicate = await call(clean1, 'POST', `/api/servmate/me/available-jobs/${jobId}/offers`, {
  amountCentavos: 150000,
});
check('a provider cannot hold two live offers on one job', duplicate.status === 409, duplicate);

const ineligibleOffer = await call(repairOnly, 'POST', `/api/servmate/me/available-jobs/${jobId}/offers`, {
  amountCentavos: 100000,
});
check(
  'an ineligible provider cannot offer, and cannot confirm the job exists',
  ineligibleOffer.status === 404,
  ineligibleOffer,
);

const farOffer = await call(farAway, 'POST', `/api/servmate/me/available-jobs/${jobId}/offers`, {
  amountCentavos: 100000,
});
check('a provider outside the coverage area cannot offer', farOffer.status === 404, farOffer);

/* ---------------------------------------------------------------- *
 * 6. Job photos are private to the owner and the matching ServMates
 * ---------------------------------------------------------------- */
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const attached = await call(customer, 'POST', `/api/jobs/${jobId}/media`, {
  dataUrl: PNG,
  caption: 'The kitchen as it stands now',
});
check('the customer can attach a photo to their job', attached.status === 201, attached);
const mediaUrl = attached.body?.media?.url;
check('the photo is referenced by an authorized route, not a storage path', typeof mediaUrl === 'string' && mediaUrl.startsWith('/api/media/'), mediaUrl);

const ownerMedia = await call(customer, 'GET', `/api/jobs/${jobId}/media`);
check('the owner lists the photo', ownerMedia.body?.media?.length === 1, ownerMedia.body);

/** Raw fetch, because the point of these two checks is the response itself. */
async function fetchMedia(url, jar) {
  const response = await fetch(`${BASE}${url}`, {
    headers: jar?.cookie ? { Cookie: jar.cookie } : {},
    redirect: 'manual',
  });
  const body = await response.arrayBuffer();
  return {
    status: response.status,
    type: response.headers.get('content-type'),
    cache: response.headers.get('cache-control'),
    bytes: body.byteLength,
  };
}

const ownerFetch = await fetchMedia(mediaUrl, customer);
check('the owner can open the photo', ownerFetch.status === 200 && ownerFetch.bytes > 0, ownerFetch);
check('the photo is served as an image and never cached', ownerFetch.type === 'image/png' && String(ownerFetch.cache).includes('no-store'), ownerFetch);

const eligibleFetch = await fetchMedia(mediaUrl, clean2);
check('a matching ServMate can open the photo', eligibleFetch.status === 200, eligibleFetch);

const ineligibleFetch = await fetchMedia(mediaUrl, repairOnly);
check('a category-ineligible provider is refused the photo', ineligibleFetch.status === 404, ineligibleFetch);

const farFetch = await fetchMedia(mediaUrl, farAway);
check('a provider outside the area is refused the photo', farFetch.status === 404, farFetch);

const anonymousFetch = await fetchMedia(mediaUrl, null);
check('a signed-out visitor is refused the photo', anonymousFetch.status === 401, anonymousFetch);

const ineligibleList = await call(repairOnly, 'GET', `/api/jobs/${jobId}/media`);
check('an ineligible provider sees no media list', (ineligibleList.body?.media ?? []).length === 0, ineligibleList.body);

const smuggled = await call(customer, 'POST', `/api/jobs/${jobId}/media`, {
  dataUrl: `data:image/png;base64,${Buffer.from('<script>alert(1)</script>').toString('base64')}`,
});
check('a file whose bytes are not an image is refused', smuggled.status === 400, smuggled);

const unrelated = await call(repairOnly, 'DELETE', `/api/jobs/${jobId}/media/${attached.body?.media?.assetId}`);
check('an unrelated provider cannot delete the photo', unrelated.status === 404, unrelated);

/* ---------------------------------------------------------------- *
 * 7. Filters narrow the authorized set
 * ---------------------------------------------------------------- */
const filteredOut = await call(clean1, 'GET', '/api/servmate/me/available-jobs?city=Tagaytay');
check('a city filter narrows the feed', !ids(filteredOut.body?.jobs ?? []).includes(jobId), filteredOut.body);
const filteredIn = await call(clean1, 'GET', '/api/servmate/me/available-jobs?categoryId=cleaning&city=Bacoor');
check('a matching filter keeps the job', ids(filteredIn.body?.jobs ?? []).includes(jobId), filteredIn.body);
const filteredCheap = await call(clean1, 'GET', '/api/servmate/me/available-jobs?budgetMaxCentavos=1000');
check('a budget filter narrows the feed', !ids(filteredCheap.body?.jobs ?? []).includes(jobId));

/* ---------------------------------------------------------------- *
 * 6b. The schedule rules narrow discovery too
 * ---------------------------------------------------------------- */
const stale = await call(customer, 'POST', '/api/jobs', {
  title: 'Deep clean for a day that has passed',
  description: 'The same unit, with a fixed start that is already behind us.',
  categoryId: 'cleaning',
  pricingModel: 'fixed',
  budgetCentavos: 120000,
  locationCity: 'Bacoor',
  locationBarangay: 'Molino IV',
  preferredStart: new Date(Date.now() - 86_400_000).toISOString(),
  scheduleFlexible: false,
});
check('a job with a fixed past start can still be posted', stale.status === 201, stale);
const staleId = stale.body?.job?.id;
const stalePublished = await call(customer, 'POST', `/api/jobs/${staleId}/publish`);
check('the customer can publish it', stalePublished.status === 200, stalePublished);

const feedStale = await call(clean1, 'GET', '/api/servmate/me/available-jobs');
check(
  'a stale fixed-start job never reaches discovery',
  !ids(feedStale.body?.jobs ?? []).includes(staleId),
  feedStale.body,
);
const staleDetail = await call(clean1, 'GET', `/api/servmate/me/available-jobs/${staleId}`);
check('and its detail answers like an absent job', staleDetail.status === 404, staleDetail);

// The live job states a start three days out, so a window around it decides.
const oneHourAfterStart = new Date(Date.parse(start) + 3_600_000).toISOString();
const tooEarly = await call(
  clean1,
  'GET',
  `/api/servmate/me/available-jobs?startFrom=${encodeURIComponent(oneHourAfterStart)}`,
);
check(
  'a startFrom filter hides a job that starts earlier',
  !ids(tooEarly.body?.jobs ?? []).includes(jobId),
  tooEarly.body,
);
const startsBefore = await call(
  clean1,
  'GET',
  `/api/servmate/me/available-jobs?startBefore=${encodeURIComponent(oneHourAfterStart)}`,
);
check('a startBefore filter keeps it', ids(startsBefore.body?.jobs ?? []).includes(jobId), startsBefore.body);
const widened = await call(
  repairOnly,
  'GET',
  '/api/servmate/me/available-jobs?categoryId=cleaning&city=Bacoor',
);
check(
  'a filter cannot widen the feed past eligibility',
  !ids(widened.body?.jobs ?? []).includes(jobId),
  widened.body,
);

/* ---------------------------------------------------------------- *
 * 8. The customer compares and accepts
 * ---------------------------------------------------------------- */
const offers = await call(customer, 'GET', `/api/jobs/${jobId}/offers`);
check('the customer sees both offers', offers.status === 200 && offers.body?.offers?.length === 2, offers);
check(
  'offers are ordered cheapest first for comparison',
  offers.body?.offers?.[0]?.offer?.amountCentavos === 165000 &&
    offers.body?.offers?.[1]?.offer?.amountCentavos === 175000,
  offers.body?.offers?.map((entry) => entry.offer.amountCentavos),
);
check(
  'each offer carries the ServMate behind it',
  offers.body?.offers?.[0]?.provider?.name === 'Cleaner Two' &&
    typeof offers.body?.offers?.[0]?.provider?.rating === 'number',
  offers.body?.offers?.[0]?.provider,
);

const otherCustomer = newJar();
await signup(otherCustomer, 'Nosy Customer', `nosy-${stamp}@e2e.test`);
const stolen = await call(otherCustomer, 'GET', `/api/jobs/${jobId}/offers`);
check('another account cannot read the offers', stolen.status === 404, stolen);

const winningOfferId = offers.body.offers[0].offer.id;
const accepted = await call(customer, 'POST', `/api/jobs/${jobId}/offers/${winningOfferId}/accept`);
check('the customer can accept an offer', accepted.status === 201, accepted);
check('accepting returns a booking reference', /^SE-[0-9A-F]{6}$/.test(accepted.body?.reference ?? ''), accepted.body);

const afterAccept = await call(customer, 'GET', `/api/jobs/${jobId}/offers`);
const statuses = Object.fromEntries(
  (afterAccept.body?.offers ?? []).map((entry) => [entry.offer.id, entry.offer.offerStatus]),
);
check('the accepted offer is accepted', statuses[winningOfferId] === 'accepted', statuses);
check(
  'CONTRACT: the losing offer is withdrawn, not left pending',
  Object.entries(statuses).some(([id, status]) => id !== winningOfferId && status === 'withdrawn'),
  statuses,
);

const jobAfter = await call(customer, 'GET', `/api/jobs/${jobId}`);
check('the job is booked', jobAfter.body?.job?.jobStatus === 'booked', jobAfter.body?.job?.jobStatus);

const booking = await call(customer, 'GET', '/api/bookings');
const created_booking = (booking.body?.bookings ?? []).find((entry) => entry.reference === accepted.body.reference);
check('the booking appears in the account', Boolean(created_booking), booking.body);

const firstOfferAfter = await call(clean1, 'GET', '/api/servmate/me/offers');
const ownOffer = (firstOfferAfter.body?.offers ?? []).find((entry) => entry.id === offer1.body.offer.id);
check('the losing provider sees their offer withdrawn', ownOffer?.offerStatus === 'withdrawn', ownOffer);

/* ---------------------------------------------------------------- *
 * 9. A closed job leaves discovery; editing is frozen
 * ---------------------------------------------------------------- */
const feed3 = await call(latecomer, 'GET', '/api/servmate/me/available-jobs');
check('a booked job is gone from discovery', !ids(feed3.body?.jobs ?? []).includes(jobId), feed3.body);
const detailClosed = await call(latecomer, 'GET', `/api/servmate/me/available-jobs/${jobId}`);
check('a booked job detail is refused to an unrelated provider', detailClosed.status === 404, detailClosed);

const editBooked = await call(customer, 'PATCH', `/api/jobs/${jobId}`, { budgetCentavos: 5000 });
check('a booked job cannot be edited', editBooked.status === 409, editBooked);

const acceptAgain = await call(customer, 'POST', `/api/jobs/${jobId}/offers/${winningOfferId}/accept`);
check('accepting the same offer twice is refused', acceptAgain.status === 409, acceptAgain);

/* ---------------------------------------------------------------- *
 * 10. Self-offering and cross-site writes
 * ---------------------------------------------------------------- */
await onboard(customer, ['cleaning'], ['Bacoor']);
const ownJobOffer = await call(customer, 'POST', `/api/servmate/me/available-jobs/${jobId}/offers`, {
  amountCentavos: 1000,
});
check('a customer who is also a ServMate cannot offer on their own job', ownJobOffer.status === 404 || ownJobOffer.status === 409, ownJobOffer);

const crossSite = await fetch(`${BASE}/api/jobs`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example', Cookie: customer.cookie },
  body: JSON.stringify({ title: 'x' }),
});
check('a cross-site write is blocked', crossSite.status === 403, crossSite.status);

const anonymous = await fetch(`${BASE}/api/jobs/mine`);
check('a signed-out caller is refused', anonymous.status === 401, anonymous.status);

/* ---------------------------------------------------------------- *
 * 11. The booked work runs its course and is reviewed
 * ---------------------------------------------------------------- */
const bookingId = accepted.body?.bookingId;
check('accepting a booking returns its id', typeof bookingId === 'string', accepted.body);

// The winning ServMate keeps the photos they agreed to; the job's own record of
// them is frozen from here on.
const bookedMedia = await fetchMedia(mediaUrl, clean2);
check('the winning ServMate keeps access to the photos', bookedMedia.status === 200, bookedMedia);

const frozenUpload = await call(customer, 'POST', `/api/jobs/${jobId}/media`, { dataUrl: PNG });
check('a booked job refuses new photos', frozenUpload.status === 409, frozenUpload);

const frozenRemoval = await call(
  customer,
  'DELETE',
  `/api/jobs/${jobId}/media/${attached.body?.media?.assetId}`,
);
check('a booked job refuses removing the photos it was agreed on', frozenRemoval.status === 409, frozenRemoval);

const strangerMedia = await fetchMedia(mediaUrl, repairOnly);
check('an ineligible provider is still refused after booking', strangerMedia.status === 404, strangerMedia);

// While the request is still live, the screen offers the withdrawal.
const requestsWhileLive = await pageStatus('/account/requests', customer);
check(
  'a live request offers its withdrawal',
  requestsWhileLive.status === 200 &&
    requestsWhileLive.text.includes(`Withdraw request ${accepted.body?.reference}`),
  requestsWhileLive.text.slice(0, 240),
);

const customerStart = await call(customer, 'POST', `/api/bookings/${bookingId}/start`);
check('the customer cannot start booked work', customerStart.status === 404, customerStart);

const started = await call(clean2, 'POST', `/api/bookings/${bookingId}/start`);
check('the ServMate can start the work', started.status === 200, started);
check('the booking is now in progress', started.body?.booking?.status === 'in_progress', started.body);

const earlyConfirm = await call(customer, 'POST', `/api/bookings/${bookingId}/confirm`);
check('the customer cannot confirm work still running', earlyConfirm.status === 409, earlyConfirm);

const earlyFinish = await call(customer, 'POST', `/api/bookings/${bookingId}/complete`);
check('the customer cannot report work finished', earlyFinish.status === 404, earlyFinish);

const finished = await call(clean2, 'POST', `/api/bookings/${bookingId}/complete`);
check('the ServMate can report the work finished', finished.status === 200, finished);
check('the booking now waits on the customer', finished.body?.booking?.status === 'completion_pending', finished.body);

const finishedTwice = await call(clean2, 'POST', `/api/bookings/${bookingId}/complete`);
check('reporting it finished twice is refused', finishedTwice.status === 409, finishedTwice);

/*
 * A dispute holds the booking rather than moving it: the complaint is the
 * customer's alone, a completion cannot slip past it, and taking it back puts
 * the booking exactly where it was.
 */
const emptyComplaint = await call(customer, 'POST', `/api/bookings/${bookingId}/dispute`, {
  action: 'open',
  reason: '   ',
});
check('an empty complaint is refused', emptyComplaint.status === 400, emptyComplaint.status);

const complaintByProvider = await call(clean2, 'POST', `/api/bookings/${bookingId}/dispute`, {
  action: 'open',
  reason: 'Everything was fine.',
});
check(
  'the ServMate cannot raise the complaint themselves',
  complaintByProvider.status === 404,
  complaintByProvider.status,
);

const opened = await call(customer, 'POST', `/api/bookings/${bookingId}/dispute`, {
  action: 'open',
  reason: 'A window was left broken.',
});
check('the customer can report a problem', opened.status === 200, opened);
check('the booking is now disputed', opened.body?.booking?.status === 'disputed', opened.body);

const confirmWhileDisputed = await call(customer, 'POST', `/api/bookings/${bookingId}/confirm`);
check(
  'a completion cannot slip past the dispute',
  confirmWhileDisputed.status === 409,
  confirmWhileDisputed.status,
);

const finishWhileDisputed = await call(clean2, 'POST', `/api/bookings/${bookingId}/complete`);
check(
  'the ServMate cannot re-report finished work either',
  finishWhileDisputed.status === 409,
  finishWhileDisputed.status,
);

const reviewWhileDisputed = await call(customer, 'POST', `/api/bookings/${bookingId}/review`, {
  rating: 1,
});
check(
  'a disputed booking cannot be reviewed',
  reviewWhileDisputed.status === 404 || reviewWhileDisputed.status === 409,
  reviewWhileDisputed.status,
);

const jobPageDuring = await pageStatus(`/account/jobs/${jobId}`, customer);
check(
  'the customer sees the dispute held open on the job page',
  jobPageDuring.status === 200 && jobPageDuring.text.includes('data-state="disputed"'),
  jobPageDuring.text.slice(0, 240),
);

const withdrawn = await call(customer, 'POST', `/api/bookings/${bookingId}/dispute`, {
  action: 'withdraw',
});
check('the customer can take the complaint back', withdrawn.status === 200, withdrawn);
check(
  'the booking returns to awaiting confirmation',
  withdrawn.body?.booking?.status === 'completion_pending',
  withdrawn.body,
);

const confirmed = await call(customer, 'POST', `/api/bookings/${bookingId}/confirm`);
check('the customer can confirm the work', confirmed.status === 200, confirmed);
check('the booking is completed', confirmed.body?.booking?.status === 'completed', confirmed.body);

const jobAfterCompletion = await call(customer, 'GET', `/api/jobs/${jobId}`);
check(
  'the job record agrees the work is completed',
  jobAfterCompletion.body?.job?.jobStatus === 'completed',
  jobAfterCompletion.body?.job?.jobStatus,
);

const startedAgain = await call(clean2, 'POST', `/api/bookings/${bookingId}/start`);
check('a finished booking cannot be started again', startedAgain.status === 409, startedAgain);

// Finished work ends with confirmation and a review, never a withdrawal: the
// route refuses it and the screen stops offering it.
const cancelWhenDone = await call(customer, 'POST', `/api/bookings/${bookingId}/cancel`);
check('a finished booking refuses cancellation', cancelWhenDone.status === 409, cancelWhenDone);
check(
  'cancelling a finished booking explains why',
  typeof cancelWhenDone.body?.message === 'string' &&
    cancelWhenDone.body.message.includes('no longer be withdrawn'),
  cancelWhenDone.body,
);

const cancelledBooking = await call(customer, 'GET', `/api/jobs/${jobId}`);
check(
  'the finished booking is untouched by the refusal',
  cancelledBooking.body?.job?.jobStatus === 'completed',
  cancelledBooking.body?.job?.jobStatus,
);

const requestsWhenDone = await pageStatus('/account/requests', customer);
check(
  'the Requests page offers no withdrawal for finished work',
  requestsWhenDone.status === 200 &&
    !requestsWhenDone.text.includes(`Withdraw request ${accepted.body?.reference}`),
  requestsWhenDone.text.slice(0, 240),
);

const lateReview = await call(clean2, 'POST', `/api/bookings/${bookingId}/review`, { rating: 3 });
check('only the customer may review the work', lateReview.status === 404, lateReview);

const earlyReview = await call(otherCustomer, 'POST', `/api/bookings/${bookingId}/review`, { rating: 3 });
check('a stranger is refused the review too', earlyReview.status === 404, earlyReview);

const review = await call(customer, 'POST', `/api/bookings/${bookingId}/review`, {
  rating: 5,
  comment: 'On time, careful with the balcony, left the place spotless.',
});
check('the customer can review completed work', review.status === 201, review);

const secondReview = await call(customer, 'POST', `/api/bookings/${bookingId}/review`, { rating: 1 });
check('a booking can be reviewed only once', secondReview.status === 409 || secondReview.status === 404, secondReview);

const badRating = await call(customer, 'POST', `/api/bookings/${bookingId}/review`, { rating: 9 });
check('a rating outside 1 to 5 is refused', badRating.status === 400, badRating);

/* ---------------------------------------------------------------- *
 * 12. Notifications land on the right desks
 * ---------------------------------------------------------------- */
const customerNotes = await call(customer, 'GET', '/api/notifications');
check('the customer has notifications', customerNotes.status === 200, customerNotes);
check(
  'the customer was told about the offer and the completion',
  (customerNotes.body?.notifications ?? []).some((note) => note.type === 'offer_received') &&
    (customerNotes.body?.notifications ?? []).some((note) => note.type === 'completion_requested'),
  customerNotes.body?.notifications?.map((note) => note.type),
);
check('the unread count is reported', (customerNotes.body?.unreadCount ?? 0) > 0, customerNotes.body?.unreadCount);

const winnerNotes = await call(clean2, 'GET', '/api/notifications');
check(
  'the winning ServMate was told the offer was accepted',
  (winnerNotes.body?.notifications ?? []).some((note) => note.type === 'offer_accepted'),
  winnerNotes.body?.notifications?.map((note) => note.type),
);
check(
  'and that they were reviewed',
  (winnerNotes.body?.notifications ?? []).some((note) => note.type === 'review_received'),
  winnerNotes.body?.notifications?.map((note) => note.type),
);
check(
  'a notification about a private job reaches only its parties',
  (await call(repairOnly, 'GET', '/api/notifications')).body?.unreadCount === 0,
);
check(
  'a losing bidder is not told about work they did not win',
  (await call(clean1, 'GET', '/api/notifications')).body?.unreadCount === 0,
);

const markedRead = await call(customer, 'POST', '/api/notifications/read', {});
check('the customer can mark everything read', markedRead.status === 200 && markedRead.body?.unreadCount === 0, markedRead);
check(
  'marking read again changes nothing',
  (await call(customer, 'POST', '/api/notifications/read', {})).body?.unreadCount === 0,
);
check(
  'the read history is kept',
  ((await call(customer, 'GET', '/api/notifications')).body?.notifications ?? []).length > 0,
);

const crossSiteRead = await fetch(`${BASE}/api/notifications/read`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example', Cookie: customer.cookie },
  body: JSON.stringify({}),
});
check('a cross-site read receipt is blocked', crossSiteRead.status === 403, crossSiteRead.status);
check(
  'a signed-out caller cannot read notifications',
  (await fetch(`${BASE}/api/notifications`)).status === 401,
);

/* ---------------------------------------------------------------- *
 * 13. Blocking and reporting
 * ---------------------------------------------------------------- */
const blocked = await call(customer, 'POST', `/api/blocks/${clean2Id}`);
check('a customer can block a ServMate', blocked.status === 200 && blocked.body?.blocked === true, blocked);
check('blocking twice is idempotent', (await call(customer, 'POST', `/api/blocks/${clean2Id}`)).status === 200);

const blockList = await call(customer, 'GET', '/api/blocks');
check(
  'the block appears in the account list',
  (blockList.body?.blocked ?? []).some((entry) => entry.userId === clean2Id),
  blockList.body,
);
check(
  "another account's list is their own",
  ((await call(clean1, 'GET', '/api/blocks')).body?.blocked ?? []).length === 0,
);

const selfBlock = await call(customer, 'POST', `/api/blocks/${customerId}`);
check('an account cannot block itself', selfBlock.status === 400, selfBlock);
check(
  'blocking an account that does not exist answers as absent',
  (await call(customer, 'POST', '/api/blocks/does-not-exist')).status === 404,
);

const crossSiteBlock = await fetch(`${BASE}/api/blocks/${clean2Id}`, {
  method: 'POST',
  headers: { Origin: 'https://evil.example', Cookie: customer.cookie },
});
check('a cross-site block is refused', crossSiteBlock.status === 403, crossSiteBlock.status);
check('a signed-out caller cannot block', (await fetch(`${BASE}/api/blocks/${clean2Id}`, { method: 'POST' })).status === 401);

const unblocked = await call(customer, 'DELETE', `/api/blocks/${clean2Id}`);
check('a block can be undone', unblocked.status === 200 && unblocked.body?.blocked === false, unblocked);
check(
  'the unblocked account is gone from the list',
  ((await call(customer, 'GET', '/api/blocks')).body?.blocked ?? []).length === 0,
);

const badReason = await call(customer, 'POST', '/api/reports', {
  reasonCode: 'because',
  reportedUserId: clean2Id,
});
check('a report needs a known reason', badReason.status === 400, badReason);

const twoThings = await call(customer, 'POST', '/api/reports', {
  reasonCode: 'spam',
  reportedUserId: clean2Id,
  reportedJobId: jobId,
});
check('a report names exactly one thing', twoThings.status === 400, twoThings);

const reportedPerson = await call(customer, 'POST', '/api/reports', {
  reasonCode: 'harassment',
  description: 'Sent repeated messages after I asked them to stop.',
  reportedUserId: clean2Id,
});
check('an account can be reported', reportedPerson.status === 201, reportedPerson);
check(
  'the same report is not stacked',
  (await call(customer, 'POST', '/api/reports', { reasonCode: 'harassment', reportedUserId: clean2Id })).status === 409,
);

const reportedJob = await call(clean2, 'POST', '/api/reports', {
  reasonCode: 'unsafe',
  reportedJobId: jobId,
});
check('the assigned ServMate can report the job they worked on', reportedJob.status === 201, reportedJob);

const reportedIneligible = await call(repairOnly, 'POST', '/api/reports', {
  reasonCode: 'unsafe',
  reportedJobId: jobId,
});
check(
  'a report cannot be used to confirm a job you cannot see',
  reportedIneligible.status === 404,
  reportedIneligible,
);

const reportedUnknownJob = await call(customer, 'POST', '/api/reports', {
  reasonCode: 'unsafe',
  reportedJobId: 'not-a-job',
});
check('reporting an absent job answers as absent', reportedUnknownJob.status === 404, reportedUnknownJob);
check(
  'a signed-out caller cannot report',
  (await fetch(`${BASE}/api/reports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status === 401,
);

// A report is a record, not a verdict: nothing changed about what anyone sees.
const afterReport = await call(clean2, 'GET', '/api/servmate/me/offers');
check('reporting hides nothing by itself', afterReport.status === 200, afterReport.status);

/*
 * A filed report used to be write-only: it went to a queue nobody could read
 * from the outside, so the reporter never learned it arrived. These checks prove
 * the reading half is scoped to the reporter — the account that filed a report
 * sees it, and no other account sees anything of it.
 */
const ownReports = await call(customer, 'GET', '/api/reports/mine');
check(
  'an account can read the reports it filed',
  ownReports.status === 200 && (ownReports.body?.reports ?? []).length >= 1,
  ownReports,
);
check(
  'each row carries the reason in words and the record\u2019s own status',
  (ownReports.body?.reports ?? []).every(
    (report) =>
      typeof report.reasonLabel === 'string' &&
      report.reasonLabel !== '' &&
      typeof report.status === 'string',
  ),
  ownReports.body,
);
check(
  'the report somebody else filed about the job is not in this list',
  !(ownReports.body?.reports ?? []).some((report) => report.reasonCode === 'unsafe'),
  ownReports.body,
);

const providerReports = await call(clean2, 'GET', '/api/reports/mine');
check(
  'the provider reads the job report they filed',
  providerReports.status === 200 &&
    (providerReports.body?.reports ?? []).some((report) => report.reasonCode === 'unsafe'),
  providerReports,
);
check(
  "another account's reports are their own",
  !(providerReports.body?.reports ?? []).some((report) => report.reasonCode === 'harassment'),
  providerReports.body,
);

const noReports = await call(otherCustomer, 'GET', '/api/reports/mine');
check(
  'an account that filed nothing gets an empty list, not somebody else\u2019s',
  noReports.status === 200 && (noReports.body?.reports ?? []).length === 0,
  noReports,
);
check(
  'a signed-out caller cannot read any reports',
  (await fetch(`${BASE}/api/reports/mine`)).status === 401,
);

/* ---------------------------------------------------------------- *
 * 14. The provider console: profile, listings, portfolio and updates
 * ---------------------------------------------------------------- */
const profileSaved = await call(clean1, 'PATCH', '/api/servmate/me', {
  headline: 'Eco deep-cleaning for condos',
  bio: 'A two-person team covering Bacoor.',
  serviceAreaLabel: 'Bacoor',
  responseMins: 20,
});
check('a ServMate can save their profile facts', profileSaved.status === 200, profileSaved);
// `otherCustomer` never enabled provider capability, so it is the account that
// must not reach any of these routes. (`customer` is onboarded as a ServMate
// later in this script, for the self-offering check.)
check(
  'an account without provider capability cannot edit a ServMate profile',
  (await call(otherCustomer, 'PATCH', '/api/servmate/me', { bio: 'Nope' })).status === 403,
);
check(
  'a bad home area is refused',
  (await call(clean1, 'PATCH', '/api/servmate/me', { serviceAreaLabel: 'Quezon City' })).status === 400,
);

const listing = await call(clean1, 'POST', '/api/servmate/me/services', {
  title: 'Deep clean · two-bedroom condo',
  description: 'Kitchen, bathrooms, living room and bedrooms.',
  categoryId: 'cleaning',
  pricingModel: 'fixed',
  amountCentavos: 180000,
  serviceAreaLabel: 'Bacoor',
  availability: 'Same day',
});
check('a listing is created as a draft', listing.status === 201 && listing.body?.listing?.publicationStatus === 'draft', listing);
const listingId = listing.body?.listing?.id;

const listingPublished = await call(clean1, 'POST', `/api/servmate/me/services/${listingId}/publish`, {});
check('a draft listing can be published', listingPublished.status === 200 && listingPublished.body?.listing?.publicationStatus === 'published', listingPublished);
check(
  "an account without provider capability cannot list a provider's own listings",
  (await call(otherCustomer, 'GET', '/api/servmate/me/services')).status === 403,
);
check(
  "another provider cannot publish this listing",
  (await call(repairOnly, 'POST', `/api/servmate/me/services/${listingId}/publish`, {})).status === 404,
);
check(
  'a listing edit with a bad field is refused',
  (await call(clean1, 'PATCH', `/api/servmate/me/services/${listingId}`, { amountCentavos: -5 })).status === 400,
);

const portfolioItem = await call(clean1, 'POST', '/api/servmate/me/portfolio', {
  title: 'Balcony and kitchen deep clean',
  description: 'Before and after from a Molino unit.',
});
check('a work example can be published', portfolioItem.status === 201, portfolioItem);
check(
  'self-published work is labelled as such',
  portfolioItem.body?.item?.source === 'self_published',
  portfolioItem.body?.item,
);

const claimedWork = await call(clean2, 'POST', '/api/servmate/me/portfolio', {
  title: 'Verified move-out clean',
  bookingId,
});
check(
  'work from a completed booking is labelled verified',
  claimedWork.status === 201 && claimedWork.body?.item?.source === 'completed_booking',
  claimedWork,
);
check(
  "another provider cannot claim that booking",
  (await call(clean1, 'POST', '/api/servmate/me/portfolio', { title: 'Mine now', bookingId })).status === 404,
);

const post = await call(clean1, 'POST', '/api/servmate/me/posts', {
  body: 'Two deep cleans booked for this weekend.',
});
check('a work update can be posted', post.status === 201, post);
check(
  'an empty update is refused',
  (await call(clean1, 'POST', '/api/servmate/me/posts', { body: '   ' })).status === 400,
);
check(
  'an update can be withdrawn',
  (await call(clean1, 'DELETE', `/api/servmate/me/posts/${post.body?.post?.id}`)).status === 200,
);
check(
  'a cross-site profile edit is refused',
  (
    await fetch(`${BASE}/api/servmate/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example', Cookie: clean1.cookie },
      body: JSON.stringify({ bio: 'x' }),
    })
  ).status === 403,
);

/* ---------------------------------------------------------------- *
 * 15. The screens these routes exist for actually render
 * ---------------------------------------------------------------- */
async function pageStatus(path, jar) {
  const response = await fetch(`${BASE}${path}`, {
    headers: jar ? { Cookie: jar.cookie } : {},
    redirect: 'manual',
  });
  return { status: response.status, text: await response.text() };
}

for (const path of [
  '/home',
  '/account/jobs',
  '/account/jobs/new',
  `/account/jobs/${jobId}`,
  '/account/notifications',
  '/account/reports',
]) {
  const page = await pageStatus(path, customer);
  check(`the customer reaches ${path}`, page.status === 200, page.status);
}

// The reports page has to show the record, not just render: the customer filed a
// report about an account earlier in this run, and it should be readable there.
const reportsPage = await pageStatus('/account/reports', customer);
check(
  'the reports page shows the report this account filed',
  reportsPage.text.includes('Harassment or abuse') && reportsPage.text.includes('Waiting for review'),
  reportsPage.text.slice(0, 160),
);

const signedOutReports = await pageStatus('/account/reports', null);
check(
  'the signed-out visitor never sees the reports page',
  signedOutReports.text.includes('/?signin=1') &&
    !signedOutReports.text.includes('Waiting for review'),
  signedOutReports.text.slice(0, 120),
);

const providerFeed = await pageStatus('/servmate/jobs', customer);
check('a ServMate reaches the provider feed', providerFeed.status === 200, providerFeed.status);

const providerConsole = await pageStatus('/servmate/profile', clean1);
check('a ServMate reaches their own console', providerConsole.status === 200, providerConsole.status);
check(
  'the console shows the listing they just created',
  providerConsole.text.includes('Deep clean · two-bedroom condo'),
  providerConsole.text.slice(0, 120),
);

const providerDetail = await pageStatus(`/servmate/jobs/${jobId}`, clean2);
check('the provider reaches the same job detail', providerDetail.status === 200, providerDetail.status);

/**
 * A refusal is a refusal even when the shell already committed a 200: what
 * matters is that none of the private content reached the page.
 */
const refusedDetail = await pageStatus(`/servmate/jobs/${jobId}`, repairOnly);
check(
  'an ineligible provider is refused the job page',
  !refusedDetail.text.includes(jobTitle),
  refusedDetail.text.slice(0, 120),
);

const signedOutJobs = await pageStatus('/account/jobs', null);
check(
  'the signed-out visitor is sent to sign in',
  signedOutJobs.text.includes('/?signin=1') && !signedOutJobs.text.includes('Post a job'),
  signedOutJobs.text.slice(0, 120),
);

const signedOutFeed = await pageStatus('/servmate/jobs', null);
check(
  'the signed-out visitor never sees the provider feed',
  signedOutFeed.text.includes('/?signin=1') &&
    !signedOutFeed.text.includes('Only jobs your categories') &&
    !signedOutFeed.text.includes('Work as a ServMate'),
  signedOutFeed.text.slice(0, 120),
);

/*
 * 11. Password recovery
 *
 * The property worth proving over HTTP is that the answer never depends on
 * whether the address has an account — and that a forged link cannot reach the
 * password form. Whether mail is actually configured, the endpoint still answers
 * the same way to both addresses.
 */

const resetPage = await pageStatus('/reset', null);
check('the reset page is reachable signed out', resetPage.status === 200, resetPage.status);
check(
  'the reset page asks for an address',
  resetPage.text.includes('Reset your password'),
  resetPage.text.slice(0, 160),
);

const resetMalformed = await call(newJar(), 'POST', '/api/auth/password-reset', {
  email: 'not-an-address',
});
check('a malformed address is refused', resetMalformed.status === 400, resetMalformed.status);

const resetUnknown = await call(newJar(), 'POST', '/api/auth/password-reset', {
  email: `nobody-${stamp}@e2e.test`,
});
const resetKnown = await call(newJar(), 'POST', '/api/auth/password-reset', {
  email: `customer-${stamp}@e2e.test`,
});
check(
  'an address with an account is answered exactly like one without',
  resetKnown.status === resetUnknown.status &&
    JSON.stringify(resetKnown.body) === JSON.stringify(resetUnknown.body),
  { known: resetKnown, unknown: resetUnknown },
);
check(
  'the recovery endpoint answers only with a documented status',
  resetKnown.status === 202 || resetKnown.status === 503,
  resetKnown.status,
);

const resetCrossSite = await fetch(`${BASE}/api/auth/password-reset`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
  body: JSON.stringify({ email: `customer-${stamp}@e2e.test` }),
  redirect: 'manual',
});
check('a cross-site recovery request is blocked', resetCrossSite.status === 403, resetCrossSite.status);

const redeemBogus = await call(newJar(), 'POST', '/api/auth/password-reset/complete', {
  token: 'f'.repeat(64),
  password: 'brand-new-password-1',
});
check('a link the server never issued is refused', redeemBogus.status === 400, redeemBogus.status);
check(
  'the refusal does not say why',
  typeof redeemBogus.body?.message === 'string' &&
    redeemBogus.body.message.includes('expired or has already been used'),
  redeemBogus.body,
);

const junkLink = await pageStatus('/reset?token=not-a-real-token', null);
check(
  'a forged link falls back to the address form',
  junkLink.status === 200 && junkLink.text.includes('data-state="request"'),
  junkLink.text.slice(0, 200),
);

const unknownLink = await pageStatus(`/reset?token=${'ab'.repeat(32)}`, null);
check(
  'a link in the right shape that the server never issued is reported as expired',
  unknownLink.status === 200 && unknownLink.text.includes('data-state="expired"'),
  unknownLink.text.slice(0, 200),
);

/* ---------------------------------------------------------------- *
 * Rate limiting: an exhausted quota answers 429 and says how long to wait
 * ---------------------------------------------------------------- *
 *
 * Blueprint §14 / TEST_STRATEGY §2 ask for proof that quota exhaustion is
 * refused over HTTP with Retry-After. One address, one email, hammered
 * until the counter trips — and then a *different* email from the same
 * caller must still be served, because the refusal is scoped to the pair,
 * not to the world.
 */

async function recoveryAttempt(email) {
  return fetch(`${BASE}/api/auth/password-reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ email }),
    redirect: 'manual',
  });
}

const quotaEmail = `quota-${stamp}@e2e.test`;
let quotaRefusal = null;
let quotaAllowed = 0;
for (let attempt = 0; attempt < 8 && !quotaRefusal; attempt += 1) {
  const response = await recoveryAttempt(quotaEmail);
  if (response.status === 429) quotaRefusal = response;
  else quotaAllowed += 1;
}
check('hammering one address eventually answers 429', Boolean(quotaRefusal), { quotaAllowed });
check(
  'the refusal arrives inside the shipped quota plus one',
  quotaRefusal && quotaAllowed <= 5,
  { quotaAllowed },
);
const retryAfter = Number.parseInt(quotaRefusal?.headers.get('Retry-After') ?? '', 10);
check('the refusal carries a Retry-After in seconds', retryAfter >= 1, {
  header: quotaRefusal?.headers.get('Retry-After'),
});
check(
  'the refusal is never cached',
  quotaRefusal?.headers.get('Cache-Control') === 'no-store',
  quotaRefusal?.headers.get('Cache-Control'),
);
const otherPair = await recoveryAttempt(`still-served-${stamp}@e2e.test`);
check(
  'a different address is still served after the refusal',
  otherPair.status === 202 || otherPair.status === 503,
  otherPair.status,
);

/*
 * 16. The moderation console
 *
 * Two halves, deliberately split. The **refusals** always run: the console is the
 * one surface in the app not answered from a customer session, so the property to
 * prove on every deployment is that a customer, a stranger and a wrong credential
 * all get the same nothing. The **privileged half** needs the deployment's own
 * token, which the server reads from its environment; supply the same value to
 * this script to exercise it:
 *
 *   SERVEM_MODERATION_TOKEN=$(openssl rand -hex 32) npm run dev -- --port 3100
 *   SERVEM_MODERATION_TOKEN=<the same value> npm run test:e2e
 *
 * Without it the privileged checks print a NOTE and are skipped rather than
 * quietly passing — a run that could not reach the console should say so.
 */
function note(message) {
  console.log(`NOTE  ${message}`);
}

const moderationToken = process.env.SERVEM_MODERATION_TOKEN ?? '';
const moderationOpen = moderationToken.length >= 24;

// --- refusals, on every deployment -------------------------------------
const anonCases = await fetch(`${BASE}/api/moderation/cases`, { redirect: 'manual' });
check('a stranger cannot read the case queue', anonCases.status === 404, anonCases.status);
check(
  'a customer session does not open the console',
  (await call(customer, 'GET', '/api/moderation/cases')).status === 404,
);
check(
  'a wrong token does not unlock the console',
  (await call(newJar(), 'POST', '/api/moderation/session', { token: `not-the-token-${stamp}` })).status === 404,
);
check(
  'a report outcome cannot be posted without the console',
  (await fetch(`${BASE}/api/moderation/reports/${reportedPerson.body?.reportId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE, Cookie: customer.cookie },
    body: JSON.stringify({ outcome: 'dismissed', note: 'The reporter moderating their own case.' }),
  })).status === 404,
);
const anonConsole = await pageStatus('/moderation', null);
check(
  'the console page shows a stranger no case data',
  !anonConsole.text.includes('Moderation queue') &&
    !anonConsole.text.includes('Sent repeated messages after I asked them to stop'),
  anonConsole.text.slice(0, 160),
);

if (!moderationOpen) {
  note('moderation console checks skipped: start the server and this script with SERVEM_MODERATION_TOKEN');
} else {
  /*
   * A job whose dispute an operator decides, rather than the customer.
   *
   * The earlier dispute in this run was withdrawn by the customer, which is the
   * point of the difference: this path exists for the case where they do not, so
   * the work is walked to `disputed` again and left there for the console.
   */
  const opsJob = await call(customer, 'POST', '/api/jobs', {
    title: `Second opinion · ${stamp}`,
    description: 'Kitchen and two bathrooms. Left unfinished and nobody replied.',
    categoryId: 'cleaning',
    pricingModel: 'fixed',
    budgetCentavos: 220000,
    locationCity: 'Bacoor',
    scheduleFlexible: true,
  });
  check('a second job for the operator path is a draft', opsJob.status === 201, opsJob);
  const opsJobId = opsJob.body?.job?.id;
  check(
    'it publishes',
    (await call(customer, 'POST', `/api/jobs/${opsJobId}/publish`, {})).status === 200,
  );

  const opsOffer = await call(clean2, 'POST', `/api/servmate/me/available-jobs/${opsJobId}/offers`, {
    amountCentavos: 220000,
    message: 'Free tomorrow morning.',
  });
  check('the provider offers on it', opsOffer.status === 201, opsOffer);
  const opsOfferId = opsOffer.body?.offer?.id;

  const opsAccepted = await call(customer, 'POST', `/api/jobs/${opsJobId}/offers/${opsOfferId}/accept`, {});
  check('the customer accepts, creating a booking', opsAccepted.status === 201, opsAccepted);
  const opsBookingId = opsAccepted.body?.bookingId;

  check('the provider starts the work', (await call(clean2, 'POST', `/api/bookings/${opsBookingId}/start`)).status === 200);
  const opsDispute = await call(customer, 'POST', `/api/bookings/${opsBookingId}/dispute`, {
    action: 'open',
    reason: 'Half the kitchen was left and the sink is still blocked.',
  });
  check('the customer freezes it with a dispute', opsDispute.status === 200, opsDispute);

  // --- the console, with the deployment's own credential -----------------
  const console_ = newJar();
  const unlocked = await call(console_, 'POST', '/api/moderation/session', { token: moderationToken });
  check('the operator token unlocks the console', unlocked.status === 200, unlocked);
  const unlockCookie = unlocked.setCookie ?? '';
  check(
    'the unlock cookie is httpOnly and same-site',
    unlockCookie.includes('servem_moderation=') &&
      unlockCookie.includes('HttpOnly') &&
      /SameSite=strict/i.test(unlockCookie),
    unlockCookie,
  );
  check(
    'the cookie carries the digest, never the token itself',
    !unlockCookie.includes(moderationToken),
    unlockCookie,
  );

  const queue = await call(console_, 'GET', '/api/moderation/cases');
  check('the operator reads the case queue', queue.status === 200, queue);
  check(
    'the queue carries the report filed earlier and the open dispute',
    (queue.body?.reports ?? []).some((entry) => entry.id === reportedPerson.body?.reportId) &&
      (queue.body?.disputes ?? []).some((entry) => entry.bookingId === opsBookingId),
    queue.body,
  );
  const disputeCase = (queue.body?.disputes ?? []).find((entry) => entry.bookingId === opsBookingId);
  check(
    'the dispute case carries both parties and how the work got here',
    disputeCase?.customer?.name && disputeCase?.provider?.name && disputeCase.timeline.length >= 1,
    disputeCase,
  );

  const consolePage = await pageStatus('/moderation', console_);
  check(
    'the console renders the queue for the operator',
    consolePage.status === 200 &&
      consolePage.text.includes('Moderation queue') &&
      consolePage.text.includes(`Second opinion · ${stamp}`),
    consolePage.text.slice(0, 200),
  );

  // --- reports ----------------------------------------------------------
  const claimFailed = await call(console_, 'POST', `/api/moderation/reports/${reportedPerson.body?.reportId}`, {
    outcome: 'sideways',
    note: 'Not an outcome.',
  });
  check('an unknown report outcome is refused', claimFailed.status === 400, claimFailed);
  check(
    'a report can be claimed for review',
    (await call(console_, 'POST', `/api/moderation/reports/${reportedPerson.body?.reportId}`, {
      outcome: 'reviewing',
    })).status === 200,
  );
  const closedWithoutNote = await call(
    console_,
    'POST',
    `/api/moderation/reports/${reportedPerson.body?.reportId}`,
    { outcome: 'resolved', note: '   ' },
  );
  check('closing a report without a note is refused', closedWithoutNote.status === 400, closedWithoutNote);
  const closed = await call(console_, 'POST', `/api/moderation/reports/${reportedPerson.body?.reportId}`, {
    outcome: 'resolved',
    note: 'Provider warned; the messages stopped.',
  });
  check(
    'closing a report records the outcome and the note',
    closed.status === 200 &&
      closed.body?.report?.status === 'resolved' &&
      closed.body?.report?.actions?.[0]?.note === 'Provider warned; the messages stopped.',
    closed,
  );
  check(
    'a closed report cannot be decided twice',
    (await call(console_, 'POST', `/api/moderation/reports/${reportedPerson.body?.reportId}`, {
      outcome: 'dismissed',
      note: 'Changing the outcome afterwards.',
    })).status === 409,
  );
  check(
    'the decided report has left the queue',
    !((await call(console_, 'GET', '/api/moderation/cases')).body?.reports ?? []).some(
      (entry) => entry.id === reportedPerson.body?.reportId,
    ),
  );

  // --- disputes ---------------------------------------------------------
  const shortNote = await call(console_, 'POST', `/api/moderation/disputes/${opsBookingId}`, {
    verdict: 'completed',
    note: 'ok',
  });
  check('a verdict needs a reason', shortNote.status === 400, shortNote);

  const verdict = await call(console_, 'POST', `/api/moderation/disputes/${opsBookingId}`, {
    verdict: 'completed',
    note: 'Photos show the kitchen finished and the sink clear; the work stands.',
  });
  check(
    'the operator moves the disputed work to completed',
    verdict.status === 200 && verdict.body?.booking?.status === 'completed',
    verdict,
  );
  check(
    'the job record agrees, for both sides',
    (await call(customer, 'GET', `/api/jobs/${opsJobId}`)).body?.job?.jobStatus === 'completed',
  );
  check(
    'the operator cannot decide the same dispute twice',
    (await call(console_, 'POST', `/api/moderation/disputes/${opsBookingId}`, {
      verdict: 'cancelled',
      note: 'Changing the outcome afterwards.',
    })).status === 409,
  );

  // Both parties were told, and neither of them was the one who decided.
  const providerTold = await call(clean2, 'GET', '/api/notifications');
  check(
    'the ServMate is told the work stands',
    (providerTold.body?.notifications ?? []).some(
      (entry) => entry.type === 'booking_confirmed' && entry.href?.includes(opsJobId),
    ),
    providerTold.body,
  );

  // Locking the console ends this browser's session and leaves the deployment's
  // token alone.
  check('the operator can lock the console', (await call(console_, 'DELETE', '/api/moderation/session')).status === 200);
  check(
    'the locked console refuses the queue again',
    (await call(console_, 'GET', '/api/moderation/cases')).status === 404,
  );
}

console.log(failures === 0 ? '\nall end-to-end checks passed' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
