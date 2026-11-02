import "dotenv/config";
import postgres from "@prisma/orm-postgres/runtime";
import { contractFromJson } from "@prisma/orm-postgres/static";
import contractJson from "./out/contract.json" with { type: "json" };

const contract = contractFromJson(contractJson as never);
const db = postgres({ url: process.env.DATABASE_URL!, contract });
const posts = await db.orm.public.Post.orderBy((p) => p.id.asc()).limit(1).all();
const p = posts[0] as unknown as Record<string, unknown>;
console.log(
  "BRIDGE createdAtType=" +
    typeof p.createdAt +
    " ctor=" +
    (p.createdAt?.constructor?.name ?? "none") +
    " value=" +
    String(p.createdAt),
);
console.log("BRIDGE updatedAtType=" + typeof p.updatedAt);
