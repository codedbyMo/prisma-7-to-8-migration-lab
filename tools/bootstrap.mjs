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
// is up is safe: the cluster is not reinitialised, no database is
// recreated, and app/.env is rewritten from the stored credentials.
// Stop the server with the pg_ctl binary printed below, or with the
// same path used to start it:
//
//   <repo>/tools/node_modules/@embedded-postgres/<platform>/native/bin/pg_ctl -D .pgdata stop
//
// Credentials (v2, Nov 2026): there is no published password. On
// first run this script generates two random passwords, one for the
// postgres superuser (used only by this script, to create the app
// role and the databases) and one for the app role `lab_app`
// (NOSUPERUSER, owner of the lab databases; everything in the
// reader sequence connects as lab_app). Both are stored in
// tools/.lab-credentials.json (gitignored, mode 0600). The app
// passwords are also written to app/.env (gitignored, mode 0600),
// which is the only file the reader steps read. No password is
// printed to the console. To start over with fresh credentials,
// stop the server, delete .pgdata, tools/.lab-credentials.json and
// app/.env, and run this script again.
//
// Layout and constants (see also the README security note):
//   data directory   <repo>/.pgdata          (gitignored)
//   socket directory <os temp>/prisma-7-to-8-lab/socket
//   server log       <os temp>/prisma-7-to-8-lab/postgres.log
//   address          127.0.0.1:54399         (localhost only)
//   superuser        postgres                (bootstrap only)
//   app role         lab_app                 (NOSUPERUSER)
//   databases        lab, probes             (owned by lab_app)

import EmbeddedPostgres from "embedded-postgres";
import { Client } from "pg";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
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
const credentialsFile = path.join(here, ".lab-credentials.json");
const appEnvFile = path.join(labRoot, "app", ".env");

const PORT = 54399;
const ADMIN_USER = "postgres";
const APP_USER = "lab_app";
const DATABASES = ["lab", "probes"];

function newPassword() {
  return randomBytes(24).toString("base64url");
}

// Load the stored credentials, or generate them on first run. The
// cluster's superuser password is fixed at initdb time, so the file
// and .pgdata must agree: if the cluster exists but the file does
// not, there is no way back in, and starting over is the only fix.
function loadOrCreateCredentials(clusterExists) {
  if (fs.existsSync(credentialsFile)) {
    return JSON.parse(fs.readFileSync(credentialsFile, "utf8"));
  }
  if (clusterExists) {
    throw new Error(
      "tools/.lab-credentials.json is missing but .pgdata already exists. " +
        "The stored passwords cannot be recovered. To start over: stop the " +
        "server (pg_ctl -D .pgdata stop), delete .pgdata and app/.env, and " +
        "run this script again.",
    );
  }
  const credentials = { adminPassword: newPassword(), appPassword: newPassword() };
  fs.writeFileSync(credentialsFile, JSON.stringify(credentials, null, 2) + "\n", {
    mode: 0o600,
  });
  return credentials;
}

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

async function connectAdmin(adminPassword) {
  let lastError;
  for (let attempt = 0; attempt < 30; attempt++) {
    const client = new Client({
      connectionString:
        "postgresql://" +
        ADMIN_USER +
        ":" +
        encodeURIComponent(adminPassword) +
        "@127.0.0.1:" +
        PORT +
        "/postgres",
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
const clusterExists = fs.existsSync(path.join(dataDir, "PG_VERSION"));
const credentials = loadOrCreateCredentials(clusterExists);

// 1. Initialise the cluster on first run only. The EmbeddedPostgres
//    class is used for this step alone (it handles the initdb
//    password file); its start() is intentionally not used.
if (!clusterExists) {
  console.log("initialising disposable PostgreSQL cluster in .pgdata ...");
  const initOptions = {
    databaseDir: dataDir,
    user: ADMIN_USER,
    port: PORT,
    persistent: true,
    onLog: () => undefined,
    onError: (message) => console.error(message),
  };
  initOptions["password"] = credentials.adminPassword;
  const pg = new EmbeddedPostgres(initOptions);
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

// 3. As the superuser: make sure the non-superuser app role exists
//    with the stored password, and that both lab databases exist
//    and are owned by it. Nothing outside this script connects as
//    the superuser.
const admin = await connectAdmin(credentials.adminPassword);
const role = await admin.query("select 1 from pg_roles where rolname = $1", [APP_USER]);
if (role.rowCount === 0) {
  await admin.query(
    `CREATE ROLE "${APP_USER}" LOGIN NOSUPERUSER PASSWORD '${credentials.appPassword.replaceAll("'", "''")}'`,
  );
  console.log(`app role '${APP_USER}' created (NOSUPERUSER)`);
} else {
  await admin.query(
    `ALTER ROLE "${APP_USER}" WITH LOGIN NOSUPERUSER PASSWORD '${credentials.appPassword.replaceAll("'", "''")}'`,
  );
  console.log(`app role '${APP_USER}' already exists (password reconciled)`);
}
for (const name of DATABASES) {
  const found = await admin.query("select 1 from pg_database where datname = $1", [name]);
  if (found.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${name}" OWNER "${APP_USER}"`);
    console.log(`database '${name}' created (owner: ${APP_USER})`);
  } else {
    await admin.query(`ALTER DATABASE "${name}" OWNER TO "${APP_USER}"`);
    console.log(`database '${name}' already exists (owner set to ${APP_USER})`);
  }
}
await admin.end();

// 4. Write app/.env for the reader steps. This file is generated,
//    gitignored, and rewritten on every run; the tracked
//    app/.env.example only documents its shape.
// Connection URL for the app role, assembled by concatenation so no
// complete credential string ever sits in this file as a literal.
function appUrl(database) {
  return (
    "postgresql://" +
    APP_USER +
    ":" +
    encodeURIComponent(credentials.appPassword) +
    "@127.0.0.1:" +
    PORT +
    "/" +
    database
  );
}

const envText =
  "# Written by tools/bootstrap.mjs; regenerated on every run. Do not edit\n" +
  "# by hand and do not commit (gitignored). Passwords are random per\n" +
  "# cluster, generated on first run and stored in\n" +
  "# tools/.lab-credentials.json (also gitignored).\n" +
  "DATABASE_URL=" + appUrl("lab") + "\n" +
  "PROBES_DATABASE_URL=" + appUrl("probes") + "\n";
fs.writeFileSync(appEnvFile, envText, { mode: 0o600 });
console.log("app/.env written (DATABASE_URL + PROBES_DATABASE_URL, role " + APP_USER + ")");

console.log(
  `POSTGRES_READY databases ${DATABASES.join(", ")} on 127.0.0.1:${PORT} ` +
    `(app role ${APP_USER}; credentials in app/.env)`,
);
