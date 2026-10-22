import { purgeDueAccounts } from './account-deletion';

/**
 * The clock the deletion retention window needs.
 *
 * `purgeDueAccounts` removes tombstones whose 30 days have passed, but nothing
 * was calling it unless a delete request happened to arrive, so an account that
 * nobody touched stayed in the store forever. This module is the missing clock:
 * `instrumentation.ts` starts it when the server process boots, so expiry is a
 * property of the running app rather than of a request someone made.
 *
 * Two habits are deliberate:
 *
 * 1. **One sweep per process, and none at build time.** The `register()` hook can
 *    run more than once in a process (local hot reload), so the timer lives on a
 *    `globalThis` key and a second start is a no-op. The interval is also
 *    `unref`'d, so a test harness or a CLI that loads the app is never held open
 *    by it.
 * 2. **The first sweep happens at boot, not one interval later.** A tombstone
 *    whose window elapsed while the process was down is due the moment the app
 *    comes back, and an hourly wait would be an hour of unnecessary retention.
 *
 * ## Deployment requirement
 *
 * The timer only runs where the process stays alive. This build's own targets —
 * `next dev` and a `next start` on a long-running box — get unattended purging
 * for free. A deployment that suspends the process between requests
 * (serverless/edge) or runs several short-lived instances must schedule a sweep
 * itself — a platform cron/queue job invoking `purgeDueAccounts` once a day is
 * enough — because a suspended process's timers do not fire. `SERVEM_PURGE_DISABLED=1`
 * turns the in-process timer off for exactly that case (one scheduled sweeper,
 * not one per instance), and `SERVEM_PURGE_INTERVAL_MS` changes the cadence
 * (clamped to 250 ms–24 h; the default is hourly so a due tombstone is removed
 * within an hour of its window elapsing).
 */

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
const MIN_INTERVAL_MS = 250;
const MAX_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** The key the one timer is stored under, so a re-import cannot start a second. */
const TIMER = Symbol.for('servem.purge-scheduler.timer');

type TimerScope = { [TIMER]?: NodeJS.Timeout };

function scope(): TimerScope {
  return globalThis as TimerScope;
}

/** How often the sweep runs, from the environment, clamped to something sane. */
function intervalMs(): number {
  const configured = Number(process.env.SERVEM_PURGE_INTERVAL_MS);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_INTERVAL_MS;
  return Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, Math.floor(configured)));
}

/** Whether this process is allowed to run the timer at all. */
function disabled(): boolean {
  return process.env.SERVEM_PURGE_DISABLED === '1';
}

/**
 * One sweep, with the outcome reported.
 *
 * The log line is the only outward sign the clock ran, and it is what an
 * operator (or `test/purge-scheduler-live.mjs`) watches for. A failure is
 * logged and swallowed: a retention window that is one tick late is a smaller
 * problem than a process that dies over it.
 */
export async function sweepExpiredAccounts(): Promise<number> {
  try {
    const purged = await purgeDueAccounts();
    if (purged > 0) {
      console.info(`[servem] retention sweep removed ${purged} expired account tombstone(s)`);
    }
    return purged;
  } catch (error) {
    console.error('[servem] retention sweep failed', error);
    return 0;
  }
}

/**
 * Starts the clock. Safe to call more than once; the second call only reports
 * that the sweep is already running. Returns whether this call started it.
 */
export function startPurgeScheduler(): boolean {
  if (disabled()) return false;
  const running = scope();
  if (running[TIMER]) return false;

  const timer = setInterval(() => {
    void sweepExpiredAccounts();
  }, intervalMs());
  // The app must be free to exit without waiting for the next tick.
  timer.unref?.();
  running[TIMER] = timer;

  // A window that elapsed while the process was down is due right now.
  void sweepExpiredAccounts();

  return true;
}

/** Whether the timer is running in this process. */
export function purgeSchedulerRunning(): boolean {
  return Boolean(scope()[TIMER]);
}
