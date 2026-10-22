/**
 * Server startup.
 *
 * Next runs `register()` once per server process, before traffic is served —
 * the one place a long-lived process can be handed work that no request will
 * trigger. Today that work is the retention clock: account tombstones must
 * expire on their own 30-day schedule, not when somebody happens to delete
 * another account (`lib/purge-scheduler.ts` states the deployment requirement
 * for hosts that do not keep a process alive).
 *
 * The Node-only guard is deliberate: importing the scheduler pulls in the file
 * store, which is `node:fs`, and an edge runtime has no filesystem to sweep.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  // `next build` collects pages in the same process shape; a build must not
  // touch the data directory.
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  const { startPurgeScheduler } = await import('./lib/purge-scheduler');
  startPurgeScheduler();
}
