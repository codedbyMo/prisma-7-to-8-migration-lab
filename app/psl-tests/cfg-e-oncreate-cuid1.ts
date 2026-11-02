import "dotenv/config";
import { definePrismaConfig } from "prisma/config";
import { defineConfig as definePostgresConfig } from "@prisma/orm-postgres/config";
export default definePrismaConfig({
  orm: definePostgresConfig({
    contract: "e-oncreate-cuid1.prisma",
    output: "out-e-oncreate-cuid1",
    db: { connection: process.env["DATABASE_URL"] },
  }),
});
