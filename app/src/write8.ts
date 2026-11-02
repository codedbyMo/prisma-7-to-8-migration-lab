// Write test: create a Tag through the Prisma ORM 8 client only.
// Proves @onCreate(cuid(2)) generates the ID in the client at runtime,
// the behaviour Prisma ORM 7 provided with @default(cuid()).
// Cleans up after itself with raw SQL so the lab data stays canonical.
import "dotenv/config";
import { Client } from "pg";
import { db } from "./prisma/db";

const created = await db.orm.public.Tag.create({ label: "written-by-v8" });
console.log("V8_CREATED_TAG " + JSON.stringify(created));
console.log(
  "V8_CREATED_ID_TYPE " +
    typeof created.id +
    " length=" +
    String(created.id).length,
);

const found = await db.orm.public.Tag.where((tag) =>
  tag.label.eq("written-by-v8"),
).all();
console.log("V8_READBACK_COUNT " + found.length);

const sql = new Client({ connectionString: process.env.DATABASE_URL });
await sql.connect();
const del = await sql.query('DELETE FROM "Tag" WHERE "label" = $1', [
  "written-by-v8",
]);
console.log("CLEANUP_DELETED_ROWS " + del.rowCount);
await sql.end();
