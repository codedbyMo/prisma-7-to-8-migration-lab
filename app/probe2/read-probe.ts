import "dotenv/config";
import "temporal-polyfill/full/global";
import postgres from "@prisma/orm-postgres/runtime";
import { contractFromJson } from "@prisma/orm-postgres/static";
import contractJson from "./out2/contract.json" with { type: "json" };

const contract = contractFromJson(contractJson as never);
const db = postgres({ url: process.env.DATABASE_URL!, contract });
const rows = await db.orm.probe.Event.all();
const e = rows[0] as unknown as Record<string, unknown>;
const v = e.happenedAt as { constructor?: { name?: string }; epochMilliseconds?: number } | string;
console.log(
  "PROBE happenedAtType=" +
    typeof v +
    " ctor=" +
    (typeof v === "object" ? (v?.constructor?.name ?? "none") : "n/a") +
    " value=" +
    String(v) +
    " epochMs=" +
    (typeof v === "object" ? (v?.epochMilliseconds ?? "n/a") : "n/a"),
);
