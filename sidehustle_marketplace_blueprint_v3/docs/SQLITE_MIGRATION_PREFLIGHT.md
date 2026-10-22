# SQLite migration — pre-flight checklist

The JSON store (`apps/public-web/lib/store.ts`, one `servem.json` written through `query` /
`transact`) is a development stand-in. This checklist is the gate for the session that swaps it
for SQLite. It is deliberately conservative: the file is the only copy of every booking two
people have agreed on, so nothing in that session may run against a store that is serving.

**One rule governs the whole session:** the migration never runs against a live data directory.
Every command below runs with `SERVEM_DATA_DIR` pointed at a scratch copy. If a step would write
to `apps/public-web/.data`, stop and re-point it.

---

## 1. Safety snapshot

Take it before the first line of migration code exists, with the dev server **stopped** (writers
must be quiesced; a snapshot taken while the server is up is not a snapshot).

```bash
cd apps/public-web
STAMP=$(date +%Y%m%d-%H%M%S)
SNAP=/tmp/servem-sqlite-$STAMP
mkdir -p "$SNAP"
```

### 1.1 Code state

```bash
git -C ../.. rev-parse HEAD            > "$SNAP/head.txt"
git -C ../.. status --porcelain        > "$SNAP/git-status.txt"
git -C ../.. bundle create "$SNAP/code.bundle" HEAD
```

`git-status.txt` is the record of what was already dirty before the session. Anything not in it
is the session's own work and must be attributable to it.

### 1.2 Data state (the one that matters)

```bash
DATA_DIR=${SERVEM_DATA_DIR:-$PWD/.data}
cp -R "$DATA_DIR" "$SNAP/data-pre"          # metadata AND media bytes
shasum -a 256 "$DATA_DIR/servem.json"       > "$SNAP/servem.json.sha256"
find "$DATA_DIR/media" -type f | sort \
  | xargs shasum -a 256                    > "$SNAP/media.sha256"
```

`$DATA_DIR/media` holds portfolio and job media bytes (`lib/media.ts`). Rows and bytes must be
restorable together — copying `servem.json` alone is an incomplete snapshot.

### 1.3 Row baseline (the evidence the gate compares against)

```bash
SERVEM_SEED=0 node -e '
const db = require(process.argv[1]);
const out = {};
for (const [k, v] of Object.entries(db)) {
  if (!Array.isArray(v)) continue;
  const rows = v.slice().sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const crypto = require("node:crypto");
  out[k] = { rows: v.length, sha256: crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex") };
}
require("node:fs").writeFileSync(process.argv[2], JSON.stringify(out, null, 2) + "\n");
' "$DATA_DIR/servem.json" "$SNAP/baseline-rows.json"
```

This is the migration's acceptance fixture: per-collection row count **and** a content hash of
the sorted rows, not just a total.

### 1.4 Environment state

```bash
node -v                              > "$SNAP/node-version.txt"
env | grep -E '^SERVEM_|^DATABASE_URL' > "$SNAP/env.txt"   # values are local dev values only
```

Record `seedVersion` from `servem.json` too — the idempotency check in §3 depends on it.

### 1.5 A second copy, made *after* the migration

After the migration has produced its SQLite database, take `data-post` the same way. `data-pre`
is the rollback; `data-post` is what the parity evidence is read from.

---

## 2. Files the migration is allowed to touch

**Allowed (the repository seam and the things only it needs):**

| Path | Why it is in scope |
|---|---|
| `apps/public-web/lib/store.ts` | The data layer itself. `query`, `transact`, `replaceDatabase`, `storeDataDir` keep their signatures — they *are* the repository interface. |
| `apps/public-web/lib/sqlite*.ts`, `apps/public-web/db/migrations/*.sql` (new) | The new implementation and its versioned schema, per `docs/architecture/database-design.md`. |
| `apps/public-web/instrumentation.ts` | Opening/preparing the database at boot, next to the purge sweep. |
| `apps/public-web/package.json` (+ lockfile) | The driver dependency. No other dependency churn in the same change. |
| `apps/public-web/.env.example` | `DATABASE_URL` / `SERVEM_DB_PATH`, documented as post-migration. |
| `apps/public-web/test/store-sqlite.test.ts` (new) | New coverage for the new implementation. |

**Forbidden:**

- **Domain modules** — `lib/bookings.ts`, `lib/conversations.ts`, `lib/account-deletion.ts`,
  `lib/offers.ts`, `lib/jobs.ts`, `lib/notifications.ts`, `lib/auth.ts`, `lib/media.ts`,
  `lib/reviews.ts`, `lib/trust.ts`, `lib/seed.ts`, `lib/purge-scheduler.ts`. No domain module
  reads a file or a table directly; if one has to change, the seam is wrong and the session stops
  to fix the seam instead.
- **Routes and components** — nothing under `app/` changes for a storage swap.
- **The e2e harness internals** — `test/e2e-live.mjs`, `test/purge-scheduler-live.mjs`,
  `test/register.mjs`, `test/ts-extension-hooks.mjs` are read-only. If the harness cannot run
  against SQLite, that is a finding to report, not a harness edit.
- **Existing unit tests** — the 130 assertions that exist today keep their expectations. New
  tests may be added; none may be weakened or skipped to make the swap pass.
- **Docs** — the runbook is written after the migration is proven, not as part of it.
- **The credential-blocked upgrades** — unchanged, as always.

---

## 3. Evidence gate

Every line must pass before the change is considered landed. Run them with the scratch data dir,
never the live one.

```bash
cd apps/public-web
export SERVEM_DATA_DIR=/tmp/servem-sqlite-$STAMP/data-post
npx tsc --noEmit                      # typecheck
npm test                              # 130 tests pass, 0 fail
npm run test:e2e                      # 242 pass, 0 fail
npm run test:purge                    # unattended purge still proven
```

Beyond the suites, these four properties are the migration's own gate:

1. **Parity.** The §1.3 script run against the migrated database reports identical row counts and
   identical per-collection hashes for every collection, with the empty collections empty rather
   than dropped. Media: `media.sha256` from `data-pre` still resolves through the repository (a
   portfolio image and a job photo open).
2. **Idempotency.** Running the migration twice on `data-pre` is a no-op — same counts, same
   hashes, no duplicate seed. Re-booting the app against the migrated store does not re-seed
   (`seedVersion` guard) and does not rewrite rows.
3. **Concurrency.** A burst of concurrent `transact` calls that each append one row leaves exactly
   N rows — the single-writer property the JSON store gave for free must hold through SQL (the
   transaction boundary is the part of `store.ts` that was designed for this).
4. **Rollback drill.** With `SERVEM_DATA_DIR` re-pointed at `data-pre`, the app boots on the JSON
   store and serves the original data. The drill is performed once, before the JSON path is
   considered removable — "we could restore it" is not evidence that restoring works.

Plus two honesty checks:

5. **The purge still fires.** Account deletion tombstones expire on the unattended schedule
   (`instrumentation.ts` → `lib/purge-scheduler.ts`), not only when a request happens to arrive.
6. **Nothing sensitive lands.** The scratch databases and the snapshot directories are outside the
   repo or gitignored; no snapshot, `.db`, WAL or `-wal`/`-shm` file is staged; no data values are
   printed into logs or the checklist itself.

---

## 4. Landing conditions

The session lands when §3 is green **and** the change still reads as a repository swap: the domain
modules are byte-identical to `data-pre`'s version, the 130 + 242 numbers are unchanged, and the
checklist itself (this file plus the four evidence artefacts) is attached to the change so the
next session can re-run the gate without re-deriving it.

Deleting the JSON store is **step 4 of the migration path** and is a separate, later change — it
lands only after the SQLite path has survived a full cycle of real use. Removing the fallback in
the same change as the swap removes the rollback drill that §3.4 just proved.
