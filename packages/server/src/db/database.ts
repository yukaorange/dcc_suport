import { Database } from "bun:sqlite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "./schema";

export type DrizzleDb = ReturnType<typeof createDatabase>;

const MIGRATIONS_FOLDER = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "drizzle");

export function createDatabase(dbPath: string) {
  const sqlite = new Database(dbPath);
  sqlite.run("PRAGMA journal_mode = WAL;");
  sqlite.run("PRAGMA foreign_keys = ON;");

  const db = drizzle({ client: sqlite, schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  return db;
}
