import Database from "better-sqlite3";
import { drizzle as drizzleSQLite } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type DrizzleDB = ReturnType<typeof drizzleSQLite<typeof schema>>;

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
    sqlite.pragma("foreign_keys = OFF");
    sqlite.pragma("busy_timeout = 10000");
    _db = drizzleSQLite(sqlite, { schema });
  } else {
    throw new Error(`Unsupported DB_DRIVER: ${driver}. MySQL/PostgreSQL support requires additional configuration.`);
  }

  return _db;
}

export async function initializeDB() {
  const db = getDB();
  const driver = process.env.DB_DRIVER || "sqlite";

  if (driver === "sqlite") {
    // Access the underlying better-sqlite3 instance
    const sqlite = (db as any).$client as Database.Database;
    const tableExists = sqlite
      .prepare(
        "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='user'",
      )
      .get() as { count: number };

    if (tableExists.count === 0) {
      // Resolve path relative to this file's location
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
