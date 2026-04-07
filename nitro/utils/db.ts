import Database from "better-sqlite3";
import { drizzle as drizzleSQLite, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// SQLite is the only fully-supported driver. MySQL/PostgreSQL require separate
// table definitions (the schema in ../db/schema.ts is SQLite-specific) and
// can be added in a future iteration.
export type DrizzleDB = BetterSQLite3Database<typeof schema>;

let _db: DrizzleDB | null = null;

export function getDB(): DrizzleDB {
  if (_db) return _db;

  const driver = process.env.DB_DRIVER || "sqlite";
  const dataDir = process.env.DATA_DIR || "./data";

  if (driver === "sqlite") {
    const dbPath = process.env.DSN || path.join(dataDir, "memos.db");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    // Foreign keys disabled to match the existing Go backend behavior and
    // allow schema migrations to run in any order without dependency errors.
    sqlite.pragma("foreign_keys = OFF");
    sqlite.pragma("busy_timeout = 10000");
    _db = drizzleSQLite(sqlite, { schema });
  } else if (driver === "mysql" || driver === "postgres") {
    throw new Error(
      `DB_DRIVER "${driver}" is not yet supported. ` +
      `MySQL and PostgreSQL require separate Drizzle table definitions for their respective dialects. ` +
      `Currently only "sqlite" (default) is supported.`,
    );
  } else {
    throw new Error(`Unsupported DB_DRIVER: ${driver}. Only "sqlite" is currently supported.`);
  }

  return _db;
}

export async function initializeDB() {
  const db = getDB();
  const driver = process.env.DB_DRIVER || "sqlite";

  if (driver === "sqlite") {
    const sqlite = (db as BetterSQLite3Database<typeof schema> & { $client: Database.Database }).$client;
    const tableExists = sqlite
      .prepare(
        "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='user'",
      )
      .get() as { count: number };

    if (tableExists.count === 0) {
      const thisDir = path.dirname(fileURLToPath(import.meta.url));
      const latestSQLPath = path.resolve(
        thisDir,
        "../../store/migration/sqlite/LATEST.sql",
      );
      if (fs.existsSync(latestSQLPath)) {
        const latestSQL = fs.readFileSync(latestSQLPath, "utf-8");
        sqlite.exec(latestSQL);
        console.log("✅ Schema applied from LATEST.sql");
      } else {
        console.warn("⚠️  LATEST.sql not found at", latestSQLPath);
      }
    }
  }

  return db;
}
