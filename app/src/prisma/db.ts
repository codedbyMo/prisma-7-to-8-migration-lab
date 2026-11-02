import "dotenv/config";
import "temporal-polyfill/full/global";
import { PrismaPg } from "@prisma/adapter-pg";
import postgres from "@prisma/orm-postgres/runtime";
import { contractFromJson } from "@prisma/orm-postgres/static";
import type { Contract } from "../../generated/prisma8/contract.d";
import contractJson from "../../generated/prisma8/contract.json" with { type: "json" };
import { PrismaClient } from "../../generated/prisma/client";

const connectionString = process.env.DATABASE_URL!;

const adapter = new PrismaPg({ connectionString });

// The Prisma ORM 7 client, still serving the routes that have not moved.
export const prisma = new PrismaClient({ adapter });

export const contract = contractFromJson<Contract>(contractJson);

// The Prisma ORM 8 client, against the same database.
export const db = postgres({ url: connectionString, contract });
