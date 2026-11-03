// Portable reader bootstrap for the Prisma 7 to 8 migration lab.
//
// Starts a disposable PostgreSQL 18.4 (the binaries shipped by the
// embedded-postgres npm package) as the current user: no root, no
// system packages, no Docker, on macOS, Windows and Linux alike.
//
//   npm --prefix tools ci      (or: cd tools && npm ci)
//   node tools/bootstrap.mjs
//
// The server is started through pg_ctl, so it keeps running after
// this script exits; the migration steps that follow connect to it
// from separate processes. Re-running this script while the server
// is up is safe: the cluster is not reinitialised and no database is
// recreated. Stop the server with the pg_ctl binary printed below,
// or with the same path used to start it:
//
//   <repo>/tools/node_modules/@embedded-postgres/<platform>/native/bin/pg_ctl -D .pgdata stop
//
// Layout and constants (see also the README security note):
//   data directory   <repo>/.pgdata          (gitignored)
//   socket directory <os temp>/prisma-7-to-8-lab/socket
//   server log       <os temp>/prisma-7-to-8-lab/postgres.log
//   address          127.0.0.1:54399         (localhost only)
//   user             postgres
//   password         labpass                 (published constant for
//                                             this disposable database)
//   databases        lab, probes             (created if missing)

import EmbeddedPostgres from "embedded-postgres";
import { Client } from "pg";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);

const here = path.dirname(fileURLToPath(import.meta.url));
const labRoot = path.resolve(here, "..");
const dataDir = path.join(labRoot, ".pgdata");
const runtimeDir = path.join(os.tmpdir(), "prisma-7-to-8-lab");
const socketDir = path.join(runtimeDir, "socket");
const logFile = path.join(runtimeDir, "postgres.log");

const PORT = 54399;
const USER = "postgres";
const PASSWORD = "labpass";
const DATABASES = ["lab", "probes"];

// Locate pg_ctl inside the platform package that embedded-postgres
// installed (linux-x64, darwin-arm64, windows-x64, ...). The server
// is deliberately started through pg_ctl rather than through the
// EmbeddedPostgres class: a class-managed server is shut down when
// this Node process exits, while pg_ctl leaves a daemon behind.
function findPgCtl() {
  const base = path.join(here, "node_modules", "@embedded-postgres");
  const exe = process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl";
  if (fs.existsSync(base)) {
    for (const entry of fs.readdirSync(base)) {
      const candidate = path.join(base, entry, "native", "bin", exe);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  throw new Error(
    "pg_ctl not found under tools/node_modules/@embedded-postgres. " +
      "Install the tools dependencies first: npm --prefix tools ci",
  );
}

async function serverRunning(pgCtl) {
  try {
    await run(pgCtl, ["-D", dataDir, "status"]);
    return true;
  } catch {
    return false; // pg_ctl exits non-zero when no server is running
  }
}

async function connectAdmin() {
  let lastError;
  for (let attempt = 0; attempt < 30; attempt++) {
    const client = new Client({
      host: "127.0.0.1",
      port: PORT,
      user: USER,
      password: PASSWORD,
      database: "postgres",
    });
    try {
      await client.connect();
      return client;
    } catch (e) {
      lastError = e;
      await client.end().catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw lastError;
}

const pgCtl = findPgCtl();
fs.mkdirSync(socketDir, { recursive: true });

// 1. Initialise the cluster on first run only. The EmbeddedPostgres
//    class is used for this step alone (it handles the initdb
//    password file); its start() is intentionally not used.
if (!fs.existsSync(path.join(dataDir, "PG_VERSION"))) {
  console.log("initialising disposable PostgreSQL cluster in .pgdata ...");
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
    onLog: () => undefined,
    onError: (message) => console.error(message),
  });
  await pg.initialise();
  console.log("cluster initialised");
} else {
  console.log("cluster already initialised (.pgdata exists)");
}

// 2. Start the server unless it is already running.
if (await serverRunning(pgCtl)) {
  console.log("server already running on 127.0.0.1:" + PORT);
} else {
  const options =
    process.platform === "win32"
      ? `-p ${PORT} -c listen_addresses=127.0.0.1`
      : `-p ${PORT} -c listen_addresses=127.0.0.1 -k ${socketDir}`;
  await run(pgCtl, ["-D", dataDir, "-l", logFile, "-o", options, "-w", "start"]);
  console.log("server started on 127.0.0.1:" + PORT + " (log: " + logFile + ")");
}

// 3. Create the lab databases if missing.
const admin = await connectAdmin();
for (const name of DATABASES) {
  const found = await admin.query("select 1 from pg_database where datname = $1", [name]);
  if (found.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${name}"`);
    console.log(`database '${name}' created`);
  } else {
    console.log(`database '${name}' already exists`);
  }
}
await admin.end();

console.log(`POSTGRES_READY postgresql://postgres:labpass@127.0.0.1:${PORT}/lab`);
