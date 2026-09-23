// db: SQLite via Node's built-in node:sqlite, no native compile step on Windows or Render
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

if (config.dbFile !== ':memory:') {
  fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });
}

const db = new DatabaseSync(config.dbFile);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// schema: matches the assignment specification
const SCHEMA = `
CREATE TABLE IF NOT EXISTS capsules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  prompt_title TEXT NOT NULL,
  prompt_version TEXT,
  prompt_text TEXT NOT NULL,
  response_summary TEXT,
  category TEXT,
  usefulness TEXT,
  reviewed INTEGER DEFAULT 0,
  improved INTEGER DEFAULT 0,
  screenshot_url TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_capsules_user_id ON capsules(user_id);
`;

// init: safe to run on every boot
function initDb() {
  db.exec(SCHEMA);
  return db;
}

module.exports = { db, initDb, SCHEMA };
