// Portable helper for the reader replay's contract variant step.
//
// The replay rewalks the sign step in the order a real migration
// meets it: the v7 database predates the contract's `subtitle`
// field, so the pre-subtitle contract is emitted and signed first,
// then the full contract is restored and emitted again. Doing that
// by hand used to mean editing the contract with sed and parking
// the original in a shared temp path (/tmp/contract-full.bak):
// GNU-only syntax that fails under macOS's BSD sed, a predictable
// shared path that can collide across clones, and no guarantee the
// restore happens if a middle step fails.
//
// This helper does the same edit with none of those properties:
//
//   node tools/contract-variant.mjs strip    # remove the subtitle
//                                            # line; the original is
//                                            # backed up beside the
//                                            # contract, in the repo
//   node tools/contract-variant.mjs restore  # put the original back
//                                            # and delete the backup
//
// Both operations refuse to run twice in a row: strip will not
// overwrite an existing backup, and restore will not run without
// one, so a half-finished replay is loud instead of silent. Pure
// Node fs calls, so the commands are identical on macOS, Windows
// and Linux.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const labRoot = path.resolve(here, "..");
const contractPath = path.join(labRoot, "app", "prisma8", "contract.prisma");
const backupPath = path.join(labRoot, "app", "prisma8", ".contract-full.bak");

const command = process.argv[2];

if (command === "strip") {
  if (fs.existsSync(backupPath)) {
    console.error(
      "contract-variant: backup already exists at app/prisma8/.contract-full.bak. " +
        "The contract is already stripped (or a previous strip was never restored). " +
        "Run `node tools/contract-variant.mjs restore` first.",
    );
    process.exit(1);
  }
  const original = fs.readFileSync(contractPath, "utf8");
  const lines = original.split("\n");
  const kept = lines.filter((line) => !/^  subtitle /.test(line));
  const removed = lines.length - kept.length;
  if (removed !== 1) {
    console.error(
      `contract-variant: expected exactly one '  subtitle ' line in the contract, found ${removed}. ` +
        "Nothing was changed.",
    );
    process.exit(1);
  }
  fs.writeFileSync(backupPath, original);
  fs.writeFileSync(contractPath, kept.join("\n"));
  console.log(
    "contract-variant: removed the subtitle line; original backed up at app/prisma8/.contract-full.bak",
  );
} else if (command === "restore") {
  if (!fs.existsSync(backupPath)) {
    console.error(
      "contract-variant: no backup at app/prisma8/.contract-full.bak. " +
        "Nothing to restore; run `node tools/contract-variant.mjs strip` first if a variant is needed.",
    );
    process.exit(1);
  }
  fs.copyFileSync(backupPath, contractPath);
  fs.unlinkSync(backupPath);
  console.log("contract-variant: full contract restored; backup removed");
} else {
  console.error("usage: node tools/contract-variant.mjs strip|restore");
  process.exit(2);
}
