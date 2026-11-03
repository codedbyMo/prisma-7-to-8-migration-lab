# Prisma 7 to 8 Migration Lab

A tested, disposable side-by-side migration of a small Prisma ORM 7
PostgreSQL app to Prisma ORM 8, built to verify every runnable claim in
blog post #20 ("Prisma 8 Is Breaking Your Schema: A Migration Guide")
before publication. Nothing in the post is presented as runnable unless
it ran here.

## Pinned versions (npm registry, October 25, 2026) — historical

This table records the first sandbox run's pins (the `latest`
pairing of its day). It is kept as history, not as install advice:
the current reader pins are the gate pairing named in the rerun
section below.

| Package | Version | Role |
| --- | --- | --- |
| `prisma` | 8.0.0-rc.27 | Prisma ORM 8 CLI (what `latest` installs) |
| `@prisma/orm-postgres` | 8.0.0-rc.20 | Prisma ORM 8 runtime library |
| `@prisma/prisma7` | 7.10.1 | Prisma ORM 7 CLI under the `prisma7` name |
| `prisma` (transitive, via `@prisma/prisma7`) | 7.10.1 | Prisma ORM 7 CLI |
| `@prisma/client` | 7.10.1 | Prisma ORM 7 client library |
| `@prisma/adapter-pg` | 7.10.1 | Prisma ORM 7 PostgreSQL driver adapter |
| `typescript` | 5.9.3 | |
| `tsx` | 4.23.15 | |
| `temporal-polyfill` | 1.0.6 | peer dependency of `@prisma/orm-postgres` |
| `pg` | 8.23.1 | |
| PostgreSQL | 18.4 | disposable local server (see below) |

Exact pins in `app/package.json`; the lockfile `app/package-lock.json` is
committed. Runtime: Node.js v24.22.1.

## Reader rerun (portable)

The whole lab replays from a fresh clone on macOS, Windows or Linux,
as a normal user: no root, no Docker, no system PostgreSQL. The
bootstrap starts the same embedded PostgreSQL 18.4 binaries through
`pg_ctl`, on `127.0.0.1:54399`, with the databases `lab` and `probes`,
and leaves the server running for the steps that follow. Current pins
are the gate pairing in `app/package.json` (Prisma 7 `7.10.1` plus the
Prisma 8 dev trio `prisma 8.0.0-rc.29-dev.177`,
`@prisma/orm-postgres 8.0.0-rc.22-dev.1`,
`@prisma/orm-framework 8.0.0-rc.22-dev.1`); see the gate rerun section
below for why the published `latest` pairing cannot be used yet.

```bash
# 1. Disposable PostgreSQL (data in .pgdata, gitignored)
npm --prefix tools ci
node tools/bootstrap.mjs        # generates random per-cluster credentials,
                                # writes app/.env, last line: POSTGRES_READY
                                # safe to re-run while the server is up

# 2. App dependencies (environment already written to app/.env by
#    the bootstrap; app/.env.example only documents its shape)
cd app && npm ci

# 3. Prisma 7 baseline
npx prisma7 validate
npx prisma7 generate
npx prisma7 migrate deploy
npm run seed
npx tsx src/integrity.ts before # snapshot the digest

# 4. Prisma 8 side. The checked-in refs/db.json already sits at the
#    final contract hash, so the replay rewalks the sign step. Emit
#    the pre-subtitle contract first (the v7 database has no subtitle
#    column yet): strip the "subtitle" line from the contract with
#    the portable Node helper (it backs the original up beside the
#    contract and refuses to run twice), emit, sign, then restore
#    the full contract and emit again.
node ../tools/contract-variant.mjs strip
npx prisma contract emit        # pre-subtitle contract, hash e2b1007
npx prisma db sign
node ../tools/contract-variant.mjs restore
npx prisma contract emit        # full contract restored, hash 75e7b46
npx prisma db migrate --advance-ref db
npx prisma migration status     # single chain, subtitle migration applied, Up to date
npx prisma migration plan --name reader_replay_head_check
                                # No changes detected, and no fork warning
npx prisma migration graph      # 2 migrations, one chain
npx prisma db verify
npx prisma db verify --strict   # Database marker and schema match contract
npm run check                   # tsc --noEmit
npx tsx src/integrity.ts after  # digest identical to the before snapshot

# 5. rc.22 date probes and the prisma7Schema bridge read. No URLs on
#    any command line: the probe steps read PROBES_DATABASE_URL from
#    app/.env, the bridge steps read DATABASE_URL from the same file.
node probe3/load-fixture.mjs    # prints FIXTURE_OK
npx prisma contract emit --config probe3/probe.config.ts
npx tsx probe3/read-probe.ts
npx prisma contract emit --config bridge/bridge.config.ts
npx tsx bridge/read-bridge.ts
```

What success looks like: the bootstrap prints `POSTGRES_READY`; the
migration status shows one chain with the subtitle migration applied;
the head plan detects no changes and prints no fork warning; verify
and verify --strict both pass; the integrity digest after the Prisma 8
migration is identical to the before digest; the probes print
`happenedAt` as a `Date`, `legacyAt` as a `Temporal.Instant`, and
`day` / `atTime` as strings. A full logged run of exactly this
sequence, from a fresh clone and under the current credential model
(random per-cluster passwords, non-superuser app role, the portable
contract-variant helper), is in `outputs/33-bootstrap-v7.txt` and
`outputs/34-replay-v7.txt`; the previous run's logs are
`outputs/30-reader-bootstrap.txt` and `outputs/31-reader-rerun.txt`,
and the migration fork the sequence proves gone is documented in
`outputs/32-migration-fork-resolution.txt`. Secret-scan and
dependency-audit evidence for the current tree is in
`outputs/35-secret-scan-and-audit.txt`.

## The app

`app/` starts as a plain Prisma ORM 7 project (the guide's step 1.1
shape): `prisma/schema.prisma` with the `prisma-client` generator and a
PostgreSQL datasource, `prisma.config.ts`, and a client built with the
`@prisma/adapter-pg` driver adapter. The models are the article's Post
and Tag with their implicit many-to-many relation. One documented
extension: Post also carries `createdAt`/`updatedAt` DateTime fields, so
the article's date claims could be tested instead of asserted.

## PostgreSQL in this sandbox (sandbox-original, superseded for readers)

This section describes the author's sandbox setup, which produced
`outputs/00` to `outputs/29`. It is root-and-Linux-only and is kept as
the historical record. Readers should not use it: the portable
equivalent is `tools/bootstrap.mjs` (see "Reader rerun (portable)"
above), and `tools/setup-postgres.sh` carries the same warning in its
header.

No Docker and no system PostgreSQL on this VM. The server is the
PostgreSQL 18.4 binary build shipped by the `embedded-postgres` npm
package (zonkyio). The package's own launcher cannot be used here: this
sandbox refuses `chown` to another uid under the home overlay, and the
VM's system state (including the `postgres` user) resets between
sessions. `tools/setup-postgres.sh` is the idempotent workaround: it
recreates the user, deploys the binaries to `/home/postgres`, initialises
a cluster if needed, starts the server on port 54399, and creates the
`lab` database. Connectivity from Node was proven before any Prisma work
(`outputs/00-postgres-connectivity.txt`).

One more sandbox quirk: `@prisma/engines`' postinstall download is reset
by this sandbox's egress proxy when driven by `@prisma/fetch-engine`,
while curl and plain Node downloads of the same URL succeed. The engine
binary was therefore fetched with curl, verified against the official
`.sha256` (match recorded in the session log), placed at
`app/node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x`,
and the postinstall then completed normally.

## What ran, phase by phase (guide: prisma.io/docs/guides/upgrade-prisma-orm/postgresql)

- **Step 0, Prisma 7 baseline.** `prisma validate` (valid),
  `prisma generate` (client 7.10.1 to `generated/prisma`),
  `prisma migrate dev --name init`, seeded 3 posts / 3 tags / 4 join rows.
  Physical facts: join table `_PostToTag` with columns `A` (uuid) and
  `B` (text); `Tag.id` is `TEXT` holding CUID strings; `Post.id` is
  `UUID DEFAULT gen_random_uuid()`; the v7 client returns `createdAt` as
  a JavaScript `Date`. Evidence: `outputs/01-*`, `outputs/02-*`,
  `outputs/03-integrity-before.txt`.
- **Phase 1, isolate Prisma 7.** Installed `@prisma/prisma7`,
  `prisma.config.ts` renamed to `prisma7.config.ts` with the
  `@prisma/prisma7/config` import. `prisma7 generate` and
  `prisma7 migrate status` ("Database schema is up to date!") pass.
  Evidence: `outputs/04-*`.
- **Phase 2, add Prisma 8.** `prisma@8.0.0-rc.27` took the `prisma`
  name (`npx prisma --version` prints `8.0.0-rc.27`, as the guide
  promises). Wrote the guide's `prisma.config.ts` with
  `definePostgresConfig` from `@prisma/orm-postgres/config`.
  `prisma contract infer` produced a first contract from the live
  database; the hand-finished contract lives at
  `app/prisma8/contract.prisma`: PostTag is an explicit model mapped
  onto `_PostToTag` (`@@map`, `@map("A")`/`@map("B")`), Tag IDs stay
  strings, and Tag.id uses `@onCreate(cuid(2))`. `prisma contract emit`
  wrote `generated/prisma8/contract.json` and `contract.d.ts` (the
  config's `output` decides the location). Evidence: `outputs/05-*`,
  `outputs/07-*`.
- **PSL tests** (`app/psl-tests/`, `outputs/06-psl-cuid-tests.txt`):
  `@default(cuid(2))` is rejected with `PSL_GENERATOR_IN_DEFAULT`
  ("Write @onCreate(cuid(2)) instead"); `@onCreate(cuid(2))` emits
  cleanly; bare `cuid()` is rejected in both positions.
- **Phase 3, one route on Prisma 8.** `app/src/prisma/db.ts` holds both
  clients (the guide's step 3.1 shape). `tsc --noEmit` passes.
  `app/src/query8.ts` runs the fluent read
  `db.orm.public.Post.orderBy((post) => post.id.asc()).limit(20).offset(0).all()`
  plus Tag and PostTag reads, while the v7 client reads the same
  database. `app/src/write8.ts` creates a Tag through the v8 client:
  it received a 24-character CUID v2 ID generated in the client.
  Evidence: `outputs/08-*`, `outputs/12-*`.
- **Phase 4, transfer migration ownership.** First `prisma db sign`
  attempt failed verification: the hand-edited contract expected an
  index on the junction table's `A` column that Prisma 7 never created
  (its `(A, B)` primary key already covers those lookups). Restoring the
  relation's `index:` attribute from the inferred contract fixed it;
  `db sign` then printed "Database signed" and advanced ref `db`.
  An additive change (`Post.subtitle`) went through
  `prisma migration plan --name add_post_subtitle` ("Planned baseline
  (7 operation(s)) + 1 operation(s)", DDL preview included),
  `prisma db migrate --advance-ref db`, and `prisma db verify`
  (also `--strict`): "Database marker and schema match contract".
  The `prisma7:migrate` script was removed at this point, per the guide.
  Evidence: `outputs/09-*`, `outputs/10-*`.
- **Phase 5, remove Prisma 7: NOT executed.** The lab's purpose is the
  side-by-side state; the removal steps are quoted from the guide in the
  article and were not run here.

## Integrity result

`app/src/integrity.ts` snapshots the physical tables directly (no ORM):
post count, tag count, join row count, the sorted Tag ID set, the sorted
join pairs, and a SHA-256 over all of it. Before the migration and after
phase 4 the digest is identical:
`a89135c1063c980958ccfdd280bbe19c2ce0cf2feca032999c638be031c10dcf`
(3 posts, 3 tags, 4 join rows; the only schema delta is the deliberate
`Post.subtitle` column). Evidence: `outputs/03-integrity-before.txt`,
`outputs/11-integrity-after.txt`.

## Date behaviour, measured (details in outputs/08, 14, 15)

| Route | Existing `timestamp(3)` column (Prisma 7 `DateTime`) | `timestamptz` column |
| --- | --- | --- |
| Prisma 7 client | JavaScript `Date` | n/a in this lab |
| Prisma 8, inferred/native contract (`TimestampString`) | `string` | n/a |
| Prisma 8, `prisma7Schema(...)` bridge | `string` | n/a |
| Prisma 8, `DateTime` field type | n/a | `Temporal.Instant` (probe schema, since dropped) |

Node 24.22.1 has no global `Temporal`; the values above were read with
`temporal-polyfill` loaded, as the PSL documentation prescribes.

## Legacy commands under the Prisma 8 CLI

`prisma migrate dev`, `prisma generate`, and `prisma validate` all exit
with code 2 and `CLI.COMMAND_MOVED` under the Prisma 8 CLI
(`outputs/13-v8-cli-moved-commands.txt`).

## Rerunning

Use the portable sequence in "Reader rerun (portable)" above. Once
the lab is up, the quick status checks are:

```bash
cd app
npx prisma7 migrate status          # v7 side healthy
npx tsx src/query8.ts               # the phase 3 read, both clients
npx prisma db verify --strict       # contract vs database
npx tsx src/integrity.ts check      # data snapshot and digest
```

## Update, November 1, 2026: rc.22 rerun

The disposable cluster does not persist between sessions, so the lab
was first rebuilt under the original pins (CLI `8.0.0-rc.27`, ORM
`8.0.0-rc.20`, Prisma 7 `7.10.1`): `prisma7 migrate deploy`, seed,
phase 4 sign / plan / migrate / verify. The rebuild reproduced the
October end state exactly (same contract storage hash
`e2b10078...`, plan output "Planned baseline (7 operation(s)) + 1
operation(s)", verify and verify --strict clean; the integrity digest
differs from October's only because the seed generated fresh IDs and
timestamps: `779594a7...`, identical before and after every later
step). Evidence: `outputs/16-*`.

The packages were then updated to the current release candidates
(CLI `8.0.0-rc.29`, `@prisma/orm-postgres` `8.0.0-rc.22`, exact pins in
`app/package.json`). Two findings, both recorded in
`outputs/19-rc22-cli-pairing-and-copies.txt`:

1. **No published CLI can currently drive the rc.22 library's
   contracts.** `contract emit`, `contract infer` and `db verify` all
   fail at contract-source resolution with `CLI.UNEXPECTED: Cannot use
   'in' operator to search for 'kind' in typeChoice`, on any contract,
   including a two-field test model. Bisection: CLI rc.28/rc.29 with
   library rc.21 (or rc.20) emit fine; with rc.22 both fail. CLI rc.29
   was published about three hours before library rc.22 on Oct 30, so
   the documented "install both at latest" pairing is, as of Nov 1,
   ahead of the CLI. The rc.22 emit / infer / bridge re-emit steps of
   this rerun therefore could not be executed; rc.22 date-type
   behaviour in the article is sourced from the rc.22 release notes
   and the official rc.21 to rc.22 upgrade recipe.
2. **The rc.22 runtime's one-copy refusal fires on npm's default
   layout** (`RUNTIME.MULTIPLE_ORM_COPIES`): npm hoisted the CLI
   tree's `@prisma/orm-framework` rc.21 to the top level, leaving two
   nested rc.22 copies. Installing `@prisma/orm-framework@8.0.0-rc.22`
   as a direct dependency (now in `app/package.json`) leaves one rc.22
   copy at the top level, as the error message prescribes.

What did run under the rc.22 runtime (`outputs/18`, `outputs/21`):
the phase 3 read and write against the artifacts emitted under the
rc.20 pairing. All counts match (3 posts, 3 tags, 4 join rows, both
clients); `createdAt` still reads as a string through the native
`TimestampString(3)` contract, now in ISO 8601 form
(`2026-11-01T13:19:49.327`; rc.21 made the string types ISO 8601);
the bridge read against the rc.20-emitted bridge artifacts also still
returns strings, which measures artifact compatibility only, not the
rc.22 bridge mapping. A Tag created through the rc.22 runtime received
a 24-character CUID v2, as in October. `tsc --noEmit` passes, and the
integrity digest is unchanged at the end.

One more PSL fact nailed down (`outputs/20-psl-cuid1-test.txt`, run
under the working CLI rc.29 + library rc.21 pairing; the current PSL
documentation states the same rule): `@onCreate(cuid(1))` is refused
with `PSL_INVALID_GENERATOR_ARGUMENT: cuid: version must be 2, got 1`.
Prisma ORM 8 has no CUID v1 generator at all.

## Gate rerun, November 1, 2026 (validation gate for post #20)

The published `latest` pairing (CLI 8.0.0-rc.29 + @prisma/orm-postgres
8.0.0-rc.22) cannot resolve a contract source: `contract emit`,
`contract infer` and `db verify` all fail with
`CLI.UNEXPECTED: Cannot use 'in' operator to search for 'kind' in typeChoice`
(reproduced in a clean room, `outputs/gate-cleanroom/`). A matched
dev-channel pairing can: `prisma@8.0.0-rc.29-dev.177` (the `dev`
dist-tag) with `@prisma/orm-postgres@8.0.0-rc.22-dev.1` and
`@prisma/orm-framework@8.0.0-rc.22-dev.1`. With that pairing installed
in `app/` (exact pins in `app/package.json`), the full gate ran on a
fresh disposable cluster: Prisma 7 baseline rebuilt and seeded, native
contract emit, `db sign`, migration plan, `db migrate`, `db verify`
(and `--strict`), `tsc --noEmit`, bridge contract emit, and the rc.22
date probes. Every step passed; the physical integrity digest is
identical before and after. Evidence: `outputs/22` to `outputs/29`.
Date probe results: the native `DateTime` type reads a `timestamptz`
column as a JavaScript `Date`; `TimestamptzTemporal` reads it as a
`Temporal.Instant`; `Date` and `Time` read as strings; the
`prisma7Schema` bridge now reads a Prisma 7 `DateTime` as a JavaScript
`Date` (it returned strings under the rc.20 pairing).

## Migration fork, resolved (Nov 1, 2026)

The gate rerun above rewound the db origin ref to recheck the plan
step, and its plan wrote a second migration,
`20261101T1425_gate_recheck`, next to the identical, already applied
`20261101T1324_add_post_subtitle`: same from and to hashes, same
single operation. The duplicate was never applied anywhere. It has
been removed; the checked-in history is now the single applied chain
(`20261101T1323_baseline`, then `20261101T1324_add_post_subtitle`).
The fresh-clone replay in `outputs/31-reader-rerun.txt` proves the
cleaned history end to end, and
`outputs/32-migration-fork-resolution.txt` records the details.

## Security note

There is no published password in this lab anymore. Earlier versions
used a hardcoded demo constant (`labpass`) for the disposable
database; that constant survives only in historical logs and
commits, and it no longer opens anything: clusters are never
created with it now, and any database it ever protected was a
throwaway local one seeded with sample blog data. (If a real system
ever reused that string as an actual password, rotate it there;
deleting history would not help and is not attempted.)

Since Nov 2026, `tools/bootstrap.mjs` generates two random
passwords per cluster on first run: one for the `postgres`
superuser, which only the bootstrap itself uses (to create the app
role and the databases), and one for the app role `lab_app`, a
NOSUPERUSER login that owns the `lab` and `probes` databases and is
the only role the reader sequence connects as. Both passwords live
in `tools/.lab-credentials.json` (gitignored, file mode 0600); the
app role's URLs are written to `app/.env` (also gitignored, mode
0600). No password is printed to the console or written into any
tracked file, and the server binds `listen_addresses` to
`127.0.0.1` explicitly. This is still a disposable local lab: do
not expose the port publicly, and do not adapt the setup for
anything beyond a local database without replacing the credential
model wholesale.
