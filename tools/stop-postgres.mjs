import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const labRoot = path.resolve(here, "..");
const pidFile = path.join(labRoot, ".pg-server.json");
const { port, dataDir } = JSON.parse(fs.readFileSync(pidFile, "utf8"));
// Find the postgres binary bundled by embedded-postgres under the data dir's parent install
const binBase = path.join(here, "node_modules", "@embedded-postgres");
console.log("dataDir:", dataDir, "port:", port);
try {
  const out = execFileSync("pgrep", ["-f", `postgres -D ${dataDir}`], { encoding: "utf8" });
  console.log("postgres pids:", out.trim());
  for (const pid of out.trim().split("\n")) {
    process.kill(Number(pid), "SIGINT"); // fast shutdown for the postmaster
  }
  console.log("stop signal sent");
} catch (e) {
  console.log("no matching postgres process found (may already be stopped)");
}
