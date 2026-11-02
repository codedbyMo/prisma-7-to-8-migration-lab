import "dotenv/config";
import { definePrismaConfig } from "prisma/config";
import { defineConfig as definePostgresConfig } from "@prisma/orm-postgres/config";

export default definePrismaConfig({
  orm: definePostgresConfig({
    contract: "out2/contract.prisma",
    output: "out2",
    db: { connection: process.env["DATABASE_URL"] },
  }),
});
