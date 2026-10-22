/**
 * Proves the retention clock runs by itself.
 *
 * `npm run test:purge` starts a real dev server against a scratch data directory
 * that already holds two expired-by-design tombstones, then watches the store
 * file until they are gone — without ever calling `/api/account`. If the purge
 * only happened when the delete route was hit, this would time out.
 *
 * The fixture separates the two halves of "unattended":
 *
 *  - `u-purge-overdue` is due before the server boots, so the boot sweep must
 *    take it (a window that elapsed while the process was down);
 *  - `u-purge-maturing` is due ~4 seconds *after* boot, so only a timer tick can
 *    take it — no startup code and no request can be responsible;
 *  - `u-purge-waiting` is still 29 days inside its window, so it must survive:
 *    a sweep that removed everything would fail this check.
 *
 * The evidence is the store file itself (the account rows, the retained booking,
 * the deletion records) plus the server's own log line, which is the sweep
 * speaking for itself. The script keeps a list of the HTTP requests it made and
 * fails if any of them touched the delete route.
 *
 * `SERVEM_PURGE_INTERVAL_MS=750` is what makes this runnable in seconds; the
 * shipped default is hourly (see `lib/purge-scheduler.ts`).
 *
 * `SERVEM_PURGE_CHECK_MODE=start` runs the same fixture against a production
 * server instead of a dev one — which is the shape the deployment requirement
 * talks about:
 *
 *   SERVEM_DIST_DIR=.next-purge-check npm run build
 *   SERVEM_PURGE_CHECK_MODE=start npm run test:purge
 *
 * In that mode the build directory belongs to the caller, so this check leaves
 * it in place (dev mode cleans up the directory it made).
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DAY_MS = 24 * 60 * 60 * 1000;
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_DIR = process.env.SERVEM_DIST_DIR ?? '.next-purge-check';
const MODE = process.env.SERVEM_PURGE_CHECK_MODE === 'start' ? 'start' : 'dev';
const dataDir = mkdtempSync(path.join(tmpdir(), 'servem-purge-'));
const storeFile = path.join(dataDir, 'servem.json');

const OVERDUE = 'u-purge-overdue';
const MATURING = 'u-purge-maturing';
const WAITING = 'u-purge-waiting';
const DETACHED = 'deleted-account';

const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();

let failures = 0;

function check(label, passed, detail) {
  if (passed) {
    console.log(`PASS  ${label}`);
    return;
  }
  failures += 1;
  console.log(`FAIL  ${label}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
}

function tombstone(id, purgeAfterIso) {
  return {
    id,
    name: 'Deleted account',
    email: `deleted+${id}@servem.invalid`,
    isServMate: false,
    createdAt: iso(now - 40 * DAY_MS),
    deletedAt: iso(now - 31 * DAY_MS),
    purgeAfter: purgeAfterIso,
  };
}

/*
 * The fixture. `SERVEM_SEED=0` is set below, so the server adds no demo rows to
 * it and what this script writes is exactly what the server reads.
 */
writeFileSync(
  storeFile,
  `${JSON.stringify(
    {
      users: [
        tombstone(OVERDUE, iso(now - 60_000)),
        tombstone(MATURING, iso(now + 4_000)),
        tombstone(WAITING, iso(now + 29 * DAY_MS)),
      ],
      sessions: [],
      bookings: [
        {
          id: 'b-purge-overdue',
          reference: 'SE-PURG01',
          userId: OVERDUE,
          status: 'completed',
          serviceTitle: 'Move-out clean',
          createdAt: iso(now - 40 * DAY_MS),
        },
        {
          id: 'b-purge-maturing',
          reference: 'SE-PURG02',
          userId: MATURING,
          status: 'completed',
          serviceTitle: 'Aircon service',
          createdAt: iso(now - 40 * DAY_MS),
        },
      ],
      accountDeletions: [
        {
          id: 'd-purge-overdue',
          userId: OVERDUE,
          requestedAt: iso(now - 31 * DAY_MS),
          purgeAfter: iso(now - 60_000),
          retainedBookingIds: ['b-purge-overdue'],
        },
        {
          id: 'd-purge-maturing',
          userId: MATURING,
          requestedAt: iso(now - 31 * DAY_MS),
          purgeAfter: iso(now + 4_000),
          retainedBookingIds: ['b-purge-maturing'],
        },
      ],
    },
    null,
    2,
  )}\n`,
  'utf8',
);

function readStore() {
  return JSON.parse(readFileSync(storeFile, 'utf8'));
}

const before = readStore();
check(
  'the scratch store holds three tombstones before the server starts',
  before.users.length === 3,
  before.users.map((row) => row.id),
);
check(
  'one of them is already past its window and one matures after boot',
  new Date(before.users.find((row) => row.id === OVERDUE).purgeAfter).getTime() < now &&
    new Date(before.users.find((row) => row.id === MATURING).purgeAfter).getTime() > now,
);

/** Every HTTP request this check makes, so "not because we called the route" is provable. */
const requests = [];

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => (port ? resolve(port) : reject(new Error('no free port'))));
    });
  });
}

const port = await freePort();
const base = `http://127.0.0.1:${port}`;

/* Next rewrites these two for whichever distDir it starts with; put them back. */
const generated = ['next-env.d.ts', 'tsconfig.json'].map((file) => {
  const target = path.join(appRoot, file);
  return { target, content: readFileSync(target, 'utf8') };
});
const restoreGenerated = () => {
  for (const entry of generated) writeFileSync(entry.target, entry.content);
};

let output = '';
const capture = (chunk) => {
  output = `${output}${chunk.toString()}`.slice(-64_000);
};

const child = spawn(
  process.execPath,
  [
    path.join(appRoot, 'node_modules/next/dist/bin/next'),
    MODE,
    '--hostname',
    '127.0.0.1',
    '--port',
    String(port),
  ],
  {
    cwd: appRoot,
    env: {
      ...process.env,
      SERVEM_DATA_DIR: dataDir,
      SERVEM_DIST_DIR: DIST_DIR,
      SERVEM_SEED: '0',
      // Seconds instead of the shipped hour, so this check runs in one.
      SERVEM_PURGE_INTERVAL_MS: '750',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  },
);
child.stdout.on('data', capture);
child.stderr.on('data', capture);

async function stop() {
  if (child.exitCode === null) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          /* already gone */
        }
        resolve();
      }, 5000);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
  restoreGenerated();
}

process.once('exit', () => {
  if (child.exitCode === null) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
  }
  restoreGenerated();
});

const startedAt = Date.now();

async function waitFor(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await predicate()) return true;
    if (Date.now() > deadline) return false;
    if (child.exitCode !== null) {
      throw new Error(`the dev server exited with code ${child.exitCode}\n${output}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

// Readiness. This is the only request the check makes, and it is not the delete
// route — nothing below calls `/api/account`.
requests.push('GET /');
const ready = await waitFor(async () => {
  try {
    const response = await fetch(`${base}/`, { redirect: 'manual' });
    return response.status > 0 && response.status < 500;
  } catch {
    return false;
  }
}, 120_000);

check('the app answers over HTTP', ready, { output: output.slice(-2000) });

const overdueGone = await waitFor(
  () => !readStore().users.some((row) => row.id === OVERDUE),
  30_000,
);
check('the window that elapsed before boot is swept by the app itself', overdueGone);

const maturingGone = await waitFor(
  () => !readStore().users.some((row) => row.id === MATURING),
  30_000,
);
const maturingMs = Date.now() - startedAt;
check('a window that elapses while the app runs is swept too', maturingGone, { maturingMs });

const after = readStore();
const ids = after.users.map((row) => row.id);
check('the tombstone still inside its window is untouched', ids.includes(WAITING), ids);
check(
  'the retained booking is detached to the deleted-account actor, not deleted',
  after.bookings.filter((row) => row.userId === DETACHED).length === 2 &&
    after.bookings.length === 2,
  after.bookings.map((row) => ({ id: row.id, userId: row.userId })),
);
check(
  'the deletion records go with the accounts they belonged to',
  after.accountDeletions.every((row) => row.userId === WAITING),
  after.accountDeletions.map((row) => row.userId),
);
/*
 * The sweep reports itself. Boot and the first ticks can land in either order,
 * so the count is summed across its lines rather than matched in one.
 */
const sweepTotals = [...output.matchAll(/retention sweep removed (\d+) expired account tombstone/g)].map(
  (match) => Number(match[1]),
);
check(
  'the sweep is what removed them, and it says so in the server log',
  sweepTotals.reduce((total, count) => total + count, 0) === 2,
  { sweepTotals, log: output.split('\n').filter((line) => line.includes('retention sweep')).slice(-3) },
);
check(
  'nothing in this check called the delete route',
  requests.every((entry) => !entry.includes('/api/account')),
  requests,
);

await stop();
rmSync(dataDir, { recursive: true, force: true });
// Only the dev run owns its build directory; a `next start` run was handed one.
if (MODE === 'dev') rmSync(path.join(appRoot, DIST_DIR), { recursive: true, force: true });

console.log(
  failures === 0
    ? `\nall retention-clock checks passed against \`next ${MODE}\` (maturing tombstone swept ${maturingMs} ms after boot)`
    : `\n${failures} retention-clock check(s) failed`,
);
process.exit(failures === 0 ? 0 : 1);
