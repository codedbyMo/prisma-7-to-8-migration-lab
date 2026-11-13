# outputs/36 - dependency audit result and triage (Nov 13, 2026)

## The audit result

On Nov 13, 2026 the post's Creative Director ran `npm audit` independently
against this lab's pinned dependency tree (the author's sandbox cannot reach
the audit endpoint: the egress proxy refuses it with 403 policy_denied, the
record preserved in outputs/35). Result: 17 affected packages, 12 high and
5 moderate severity. These totals include transitive and metavulnerability
propagation; they are not 17 proven exploits, and nothing in the result is
evidence that lab data was compromised.

Named locked examples from that run: @hono/node-server 1.19.9
(GHSA-wc8c-qw6v-h7f6), hono 4.11.4, lodash 4.17.21 (GHSA-r5fr-rjxr-66jc),
plus glob, minimatch and valibot.

## Triage against the pinned lockfile (app/package-lock.json at af200d4c)

- @hono/node-server 1.19.9: depended on only by @prisma/dev.
- hono 4.11.4: depended on by @hono/node-server, @neon/functions, @prisma/dev.
- valibot 1.2.0: depended on by @prisma/dev (and the Prisma 7 CLI's own copy).
- lodash 4.17.21: depended on by the chevrotain parser family and @visx
  (CLI-side parsing and rendering tooling).
- glob 13.0.6: depended on by @vercel/nft (file tracing tooling);
  minimatch 10.2.6 comes in through glob.

None of the flagged packages is a dependency of @prisma/orm-postgres,
@prisma/orm-framework, the pg driver, or the application code paths this
lab exercises (seed, integrity snapshot, probes). The guide's commands
(contract emit, db sign, migration plan/status/graph, db migrate,
db verify, tsc --noEmit) never start @prisma/dev's server; the lab never
runs `prisma dev` at all.

## Residual exposure, and why it is accepted for this lab

The flagged code sits in CLI-side tooling that runs locally, against a
disposable PostgreSQL cluster bound to loopback, with per-run random
credentials, a non-superuser app role, and no production data. On that
footing the residual exposure is documented and accepted for an isolated
evaluation lab. It is not a posture for a deployed service: re-audit on
the GA pairing, and treat any lockfile change as a reason to rerun the
full gate.

Do NOT run `npm audit fix --force` against this tree: npm proposes
downgrading the CLI to Prisma 7 for some of these fixes, which would
invalidate the tested Prisma 8 pairing.
