import { config } from "dotenv";
config({ path: ".env.local" });
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url:
      process.env["DATABASE_URL"] ||
      process.env["DIRECT_URL"] ||
      process.env["SUPABASE_DATABASE_URL"] ||
      process.env["POSTGRES_URL_NON_POOLING"] ||
      process.env["POSTGRES_PRISMA_URL"] ||
      process.env["POSTGRES_URL"] ||
      "",
  },
});
