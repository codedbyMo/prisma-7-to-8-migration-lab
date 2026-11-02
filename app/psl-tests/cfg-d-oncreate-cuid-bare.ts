import "dotenv/config";
import { definePrismaConfig } from "prisma/config";
import { defineConfig as definePostgresConfig } from "@prisma/orm-postgres/config";
export default definePrismaConfig({
  orm: definePostgresConfig({
    contract: "d-oncreate-cuid-bare.prisma",
    output: "out-d-oncreate-cuid-bare",
    db: { connection: process.env["DATABASE_URL"] },
  }),
});
