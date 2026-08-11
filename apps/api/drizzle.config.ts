import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/database/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://fangyu:fangyu_dev@localhost:5432/fangyu_nexus",
  },
  strict: true,
  verbose: true,
});
