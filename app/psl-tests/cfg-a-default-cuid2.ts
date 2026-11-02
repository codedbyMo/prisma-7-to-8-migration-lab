import "dotenv/config";
import { definePrismaConfig } from "prisma/config";
import { defineConfig as definePostgresConfig } from "@prisma/orm-postgres/config";
export default definePrismaConfig({
  orm: definePostgresConfig({
    contract: "a-default-cuid2.prisma",
    output: "out-a-default-cuid2",
    db: { connection: process.env["DATABASE_URL"] },
  }),
});
