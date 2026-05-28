import { config } from "dotenv";
config({ path: ".env.local" });
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Non-pooling (direct) URL for migrations; pooled URL as fallback for runtime
    url:
      process.env["SUPABASE_DATABASE_URL"] ||
      process.env["POSTGRES_URL_NON_POOLING"] ||
      process.env["POSTGRES_PRISMA_URL"] ||
      process.env["POSTGRES_URL"] ||
      process.env["DATABASE_URL"],
  },
});
