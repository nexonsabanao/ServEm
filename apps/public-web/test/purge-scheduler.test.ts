import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * The retention clock's own behaviour, at the unit level.
 *
 * The wiring is proved end to end by `npm run test:purge`, which starts a real
 * server and watches a scratch store; what these cases pin down is the part a
 * live run cannot show cheaply:
 *
 *  - a process told not to run the timer starts nothing (the deployment case
 *    where one scheduled sweeper already owns expiry);
 *  - starting it is idempotent, so a hot reload or a second `register()` cannot
 *    leave two timers sweeping the same store;
 *  - with the timer running, a tombstone past its window is removed by the clock
 *    itself — the test never calls `purgeDueAccounts`.
 *
 * `SERVEM_PURGE_INTERVAL_MS` is read at each start, so this file can use a
 * 40 ms cadence instead of the shipped hour.
 */

process.env.SERVEM_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'servem-purge-unit-'));
process.env.SERVEM_SEED = '0';
process.env.SERVEM_PURGE_INTERVAL_MS = '40';

const { purgeSchedulerRunning, startPurgeScheduler } = await import('../lib/purge-scheduler.ts');
const { query, transact } = await import('../lib/store.ts');

const DUE = 'u-clock-due';
const WAITING = 'u-clock-waiting';

const DAY_MS = 24 * 60 * 60 * 1000;

async function installTombstones(): Promise<void> {
  await transact((database) => {
    const stamp = new Date(Date.now() - 40 * DAY_MS).toISOString();
    database.users.push(
      {
        id: DUE,
        name: 'Deleted account',
        email: `deleted+${DUE}@servem.invalid`,
        createdAt: stamp,
        deletedAt: stamp,
        purgeAfter: new Date(Date.now() - 1000).toISOString(),
      },
      {
        id: WAITING,
        name: 'Deleted account',
        email: `deleted+${WAITING}@servem.invalid`,
        createdAt: stamp,
        deletedAt: stamp,
        purgeAfter: new Date(Date.now() + 30 * DAY_MS).toISOString(),
      },
    );
  });
}

test('a process told not to run the clock starts nothing', () => {
  process.env.SERVEM_PURGE_DISABLED = '1';
  assert.equal(startPurgeScheduler(), false);
  assert.equal(purgeSchedulerRunning(), false);
  delete process.env.SERVEM_PURGE_DISABLED;
});

test('the clock starts once and sweeps a due tombstone by itself', async () => {
  await installTombstones();

  assert.equal(startPurgeScheduler(), true);
  assert.equal(purgeSchedulerRunning(), true);
  // A second start — a hot reload, a repeated `register()` — must not add a
  // second timer, and says so rather than pretending it worked.
  assert.equal(startPurgeScheduler(), false);

  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const users = await query((database) => database.users.map((row) => row.id));
    if (!users.includes(DUE)) break;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  const users = await query((database) => database.users.map((row) => row.id));
  assert.equal(users.includes(DUE), false);
  // The clock is a window, not a wipe.
  assert.equal(users.includes(WAITING), true);
});
