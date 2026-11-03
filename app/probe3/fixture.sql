-- Fixture for the rc.22 date probes (app/probe3), run against the
-- "probes" database. The original October probe table was created ad
-- hoc and never committed; this file records it so the probes are
-- reproducible from a fresh clone. Column types follow the contract
-- that `prisma contract infer` produced from the original table
-- (app/probe3/contract.inferred.prisma): both timestamp columns are
-- timestamptz(3), read back as DateTime before the hand edit that
-- turned legacyAt into TimestamptzTemporal.
--
-- Apply with any PostgreSQL client connected to the probes database.
-- The lab's loader does exactly that, reading PROBES_DATABASE_URL
-- from app/.env (written by tools/bootstrap.mjs): from app/, run
--   node probe3/load-fixture.mjs
-- which prints FIXTURE_OK on success.
CREATE TABLE IF NOT EXISTS "ProbeEvent" (
  "id" integer NOT NULL,
  "happenedAt" timestamptz(3),
  "legacyAt" timestamptz(3),
  "day" date,
  "atTime" time(3),
  CONSTRAINT "ProbeEvent_pkey" PRIMARY KEY ("id")
);
INSERT INTO "ProbeEvent" ("id", "happenedAt", "legacyAt", "day", "atTime")
VALUES (1, '2026-11-01 10:15:30.123+00', '2026-11-01 10:15:30.123+00', '2026-11-01', '10:15:30.123')
ON CONFLICT ("id") DO NOTHING;
