// Secret scan for the lab's tracked files.
//
//   node tools/secret-scan.mjs
//
// Scans every file git tracks (git ls-files) for high-signal
// credential patterns. Exit code 0 means no FAIL findings; the
// retired demo constant is reported separately as historical when
// it appears in run logs under outputs/ or in README prose, and is
// a FAIL anywhere in code. Patterns:
//
//   FAIL  private key markers (BEGIN ... PRIVATE KEY)
//   FAIL  a URL with an embedded password (scheme://user:pass@host)
//         in any file except historical logs under outputs/
//   FAIL  the retired demo constant in code files
//         (.mjs/.js/.ts/.sh/.sql/.json, outside outputs/)
//   FAIL  a quoted password literal assigned in code
//         (password: "..." / password = "...")
//   NOTE  the retired demo constant in outputs/** logs and README
//         prose: historical references, kept deliberately; the
//         credential model that replaces it is described in the
//         README security note.
//
// Deliberately small and dependency-free: it is a tripwire for this
// repository, not a general-purpose scanner.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const labRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SELF = "tools/secret-scan.mjs"; // defines the patterns; cannot scan itself
const files = execFileSync("git", ["ls-files"], { cwd: labRoot, encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((rel) => rel !== SELF);

const CODE = /\.(mjs|js|ts|sh|sql|json)$/;
const RETIRED = "lab" + "pass"; // split so this scanner does not flag itself
let fails = 0;
let notes = 0;

for (const rel of files) {
  const abs = path.join(labRoot, rel);
  let text;
  try {
    text = fs.readFileSync(abs, "utf8");
  } catch {
    continue; // binary or unreadable: skip
  }
  if (text.includes("\0")) continue;
  const inOutputs = rel.startsWith("outputs/");
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    const at = `${rel}:${i + 1}`;
    if (/BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/.test(line)) {
      console.log(`FAIL ${at} private key marker`);
      fails++;
    }
    if (/[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@/i.test(line) && !inOutputs) {
      console.log(`FAIL ${at} URL with embedded password outside historical logs`);
      fails++;
    }
    if (/password\s*[:=]\s*["'][^"']+["']/i.test(line) && CODE.test(rel) && !inOutputs) {
      console.log(`FAIL ${at} quoted password literal assigned in code`);
      fails++;
    }
    if (line.includes(RETIRED)) {
      if (inOutputs || rel === "README.md") {
        console.log(`NOTE ${at} retired demo constant (historical reference)`);
        notes++;
      } else {
        console.log(`FAIL ${at} retired demo constant outside historical logs/prose`);
        fails++;
      }
    }
  });
}

console.log(`secret-scan: ${files.length} tracked files, ${fails} FAIL, ${notes} NOTE`);
process.exit(fails === 0 ? 0 : 1);
