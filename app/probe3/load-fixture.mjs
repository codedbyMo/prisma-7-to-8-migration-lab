// Load probe3/fixture.sql into the probes database.
// Replaces a shell one-liner that needed the probes URL pasted into
// the command line: the URL now comes from app/.env (written by
// tools/bootstrap.mjs) via dotenv, like every other probe step.
// Run from app/:  node probe3/load-fixture.mjs
import "dotenv/config";
import { Client } from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.PROBES_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error(
    "load-fixture: no PROBES_DATABASE_URL/DATABASE_URL in the environment or app/.env. Run tools/bootstrap.mjs first.",
  );
  process.exit(1);
}
const fixture = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "fixture.sql"),
  "utf8",
);
const client = new Client({ connectionString: url });
await client.connect();
await client.query(fixture);
await client.end();
console.log("FIXTURE_OK");
