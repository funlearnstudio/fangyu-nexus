import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import { createDatabaseClient } from "./client";

async function main() {
  const migrationsFolder = path.resolve(__dirname, "..", "..", "drizzle");
  const { db, sql } = createDatabaseClient();

  try {
    await migrate(db, { migrationsFolder });
    console.log("Database migrations completed.");
  } finally {
    await sql.end();
  }
}

void main();
