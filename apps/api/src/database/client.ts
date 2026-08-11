import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDatabaseClient() {
  const connectionString =
    process.env.DATABASE_URL ??
    "postgresql://fangyu:fangyu_dev@localhost:5432/fangyu_nexus";
  const sql = postgres(connectionString, {
    max: 5,
    connect_timeout: 5,
  });
  return {
    db: drizzle(sql, { schema }),
    sql,
  };
}
