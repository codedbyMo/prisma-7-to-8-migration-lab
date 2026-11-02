import "dotenv/config";
import "temporal-polyfill/full/global";
import postgres from "@prisma/orm-postgres/runtime";
import { contractFromJson } from "@prisma/orm-postgres/static";
import contractJson from "./out/contract.json" with { type: "json" };

const contract = contractFromJson(contractJson as never);
const db = postgres({ url: process.env.DATABASE_URL!, contract });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rows = await (db.orm as any).public.ProbeEvent.all();
const e = rows[0];
for (const f of ["happenedAt", "legacyAt", "day", "atTime"]) {
  const v = e[f];
  console.log(
    "PROBE " + f +
    " typeof=" + typeof v +
    " ctor=" + (v?.constructor?.name ?? "none") +
    " isDate=" + (v instanceof Date) +
    " isTemporalInstant=" + (typeof Temporal !== "undefined" && v instanceof Temporal.Instant) +
    " value=" + String(v),
  );
}
