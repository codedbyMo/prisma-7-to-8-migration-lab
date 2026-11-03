import "dotenv/config";
import { definePrismaConfig } from "prisma/config";
import { defineConfig as definePostgresConfig } from "@prisma/orm-postgres/config";

export default definePrismaConfig({
  orm: definePostgresConfig({
    contract: "contract.prisma",
    output: "out",
    db: {
      connection:
        process.env["PROBES_DATABASE_URL"] ?? process.env["DATABASE_URL"],
    },
  }),
});
