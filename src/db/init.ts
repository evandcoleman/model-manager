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
  is_local INTEGER NOT NULL DEFAULT 0
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
`;

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
  sqlite.close();
  console.log("Database initialized.");
}

// Run if called directly
if (require.main === module) {
  initDatabase();
}
