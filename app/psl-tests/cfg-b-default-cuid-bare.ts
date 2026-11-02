import "dotenv/config";
import { definePrismaConfig } from "prisma/config";
import { defineConfig as definePostgresConfig } from "@prisma/orm-postgres/config";
export default definePrismaConfig({
  orm: definePostgresConfig({
    contract: "b-default-cuid-bare.prisma",
    output: "out-b-default-cuid-bare",
    db: { connection: process.env["DATABASE_URL"] },
  }),
});
