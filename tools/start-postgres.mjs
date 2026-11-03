import EmbeddedPostgres from "embedded-postgres";
import { Client } from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// RETIRED (Nov 2026): this was the author's sandbox launcher, kept
// for the historical record. It refuses to run. It predates the
// credential model of the reader bootstrap (it carried the old
// published demo password) and manages the server through the
// EmbeddedPostgres class instead of pg_ctl. The supported entry
// point is tools/bootstrap.mjs.
console.error(
  "start-postgres.mjs is the retired sandbox launcher and refuses to run.\n" +
    "Readers: use the portable bootstrap instead: node tools/bootstrap.mjs",
);
process.exit(1);

const here = path.dirname(fileURLToPath(import.meta.url));
const labRoot = path.resolve(here, "..");
const dataDir = path.join(labRoot, ".pgdata");
const pidFile = path.join(labRoot, ".pg-server.json");
const PORT = 54399;

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "",
  port: PORT,
  persistent: true,
  createPostgresUser: true,
});

const fresh = !fs.existsSync(path.join(dataDir, "PG_VERSION"));
if (fresh) {
  console.log("initialising cluster (downloads PostgreSQL binaries on first run)...");
  await pg.initialise();
}
console.log("starting postgres on port", PORT, "...");
await pg.start();
try {
  await pg.createDatabase("lab");
  console.log("database 'lab' created");
} catch (e) {
  console.log("database 'lab' already exists:", e.message);
}

// Prove a plain Node process can connect over TCP and run a query.
const client = new Client({
  host: "127.0.0.1",
  port: PORT,
  user: "postgres",
  password: "",
  database: "lab",
});
await client.connect();
const res = await client.query("select version() as v, current_database() as db");
console.log("CONNECT_OK", JSON.stringify(res.rows[0]));
await client.end();

fs.writeFileSync(pidFile, JSON.stringify({ port: PORT, dataDir }, null, 2));
console.log("SERVER_RUNNING pid file written. Leave this process running; stop with stop-postgres.mjs");
setInterval(() => {}, 1 << 30);
