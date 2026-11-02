// Data-integrity snapshot for the Prisma 7 -> 8 migration lab.
// Reads the physical tables directly (no ORM), so the same script can run
// before and after the migration. Usage: npx tsx src/integrity.ts <label>
import "dotenv/config";
import { createHash } from "node:crypto";
import { Client } from "pg";

const label = process.argv[2] ?? "snapshot";

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const posts = await client.query('SELECT count(*)::int AS n FROM "Post"');
const tags = await client.query('SELECT count(*)::int AS n FROM "Tag"');
const joins = await client.query('SELECT count(*)::int AS n FROM "_PostToTag"');
const tagIds = await client.query('SELECT "id" FROM "Tag" ORDER BY "id"');
const postIds = await client.query('SELECT "id" FROM "Post" ORDER BY "id"');
const pairs = await client.query(
  'SELECT "A", "B" FROM "_PostToTag" ORDER BY "A", "B"',
);
const cols = await client.query(
  `SELECT table_name, column_name, data_type, udt_name
     FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position`,
);

const canonical = JSON.stringify({
  tagIds: tagIds.rows.map((r) => r.id),
  postIds: postIds.rows.map((r) => r.id),
  pairs: pairs.rows.map((r) => [r.A, r.B]),
});
const digest = createHash("sha256").update(canonical).digest("hex");

console.log("LABEL " + label);
console.log("postCount " + posts.rows[0].n);
console.log("tagCount " + tags.rows[0].n);
console.log("joinCount " + joins.rows[0].n);
console.log("tagIds " + JSON.stringify(tagIds.rows.map((r) => r.id)));
console.log("joinPairs " + JSON.stringify(pairs.rows.map((r) => [r.A, r.B])));
console.log("sha256 " + digest);
console.log("COLUMNS");
for (const c of cols.rows) {
  console.log(`  ${c.table_name}.${c.column_name} ${c.udt_name}`);
}

await client.end();
