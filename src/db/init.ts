import Database from "better-sqlite3";
import { getConfig } from "../lib/config";
import fs from "fs";
import path from "path";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS models (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_size REAL,
  category TEXT,
  subcategory TEXT,
  base_model TEXT,
  nsfw_level INTEGER DEFAULT 0,
  creator_name TEXT,
  creator_avatar TEXT,
  tags TEXT,
  stats TEXT,
  trained_words TEXT,
  licensing_info TEXT,
  has_metadata INTEGER NOT NULL DEFAULT 0,
  scanned_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS model_versions (
  id INTEGER PRIMARY KEY,
  model_id INTEGER NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_model TEXT,
  description TEXT,
  stats TEXT,
  published_at TEXT,
  trained_words TEXT,
  is_local INTEGER NOT NULL DEFAULT 0,
  local_path TEXT,
  local_file_size REAL
);

CREATE TABLE IF NOT EXISTS model_files (
  id INTEGER PRIMARY KEY,
  version_id INTEGER NOT NULL REFERENCES model_versions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  size_kb REAL,
  format TEXT,
  precision TEXT,
  hashes TEXT,
  scan_results TEXT
);

CREATE TABLE IF NOT EXISTS images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_id INTEGER NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  version_id INTEGER REFERENCES model_versions(id) ON DELETE CASCADE,
  local_path TEXT,
  thumb_path TEXT,
  width INTEGER,
  height INTEGER,
  nsfw_level INTEGER DEFAULT 0,
  prompt TEXT,
  generation_params TEXT,
  blurhash TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_id INTEGER NOT NULL UNIQUE,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_notes_model_id ON user_notes(model_id);

CREATE TABLE IF NOT EXISTS user_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_id INTEGER NOT NULL,
  version_id INTEGER,
  local_path TEXT NOT NULL,
  thumb_path TEXT,
  width INTEGER,
  height INTEGER,
  nsfw_level INTEGER DEFAULT 0,
  prompt TEXT,
  generation_params TEXT,
  blurhash TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_images_model_id ON user_images(model_id);
CREATE INDEX IF NOT EXISTS idx_user_images_version_id ON user_images(version_id);
`;

// Migrations to run on existing databases
const MIGRATIONS: Array<{ name: string; sql: string }> = [
  {
    name: "add_local_path_to_model_versions",
    sql: "ALTER TABLE model_versions ADD COLUMN local_path TEXT",
  },
  {
    name: "add_local_file_size_to_model_versions",
    sql: "ALTER TABLE model_versions ADD COLUMN local_file_size REAL",
  },
  {
    name: "add_version_id_to_user_images",
    sql: "ALTER TABLE user_images ADD COLUMN version_id INTEGER",
  },
];

export function initDatabase(): void {
  const config = getConfig();
  const dbPath = config.dbPath;
  const dir = path.dirname(dbPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log(`Initializing database at ${dbPath}...`);
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(SCHEMA_SQL);

  // Run migrations (ignore errors if column already exists)
  for (const migration of MIGRATIONS) {
    try {
      sqlite.exec(migration.sql);
      console.log(`Migration applied: ${migration.name}`);
    } catch (err) {
      // Ignore "duplicate column" errors
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("duplicate column")) {
        throw err;
      }
    }
  }

  sqlite.close();
  console.log("Database initialized.");
}

// Run if called directly
if (require.main === module) {
  initDatabase();
}
