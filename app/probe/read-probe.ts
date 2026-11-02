import "dotenv/config";
import "temporal-polyfill/full/global";
import postgres from "@prisma/orm-postgres/runtime";
import { contractFromJson } from "@prisma/orm-postgres/static";
import contractJson from "./out/contract.json" with { type: "json" };

const contract = contractFromJson(contractJson as never);
const db = postgres({ url: process.env.DATABASE_URL!, contract });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rows = await (db.orm as any).probe.Event.all();
const e = rows[0];
console.log(
  "PROBE happenedAtType=" +
    typeof e.happenedAt +
    " ctor=" +
    (e.happenedAt?.constructor?.name ?? "none") +
    " value=" +
    String(e.happenedAt) +
    " epochMs=" +
    (e.happenedAt?.epochMilliseconds ?? "n/a"),
);
