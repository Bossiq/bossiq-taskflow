/**
 * TaskFlow Database Layer — Auto-switches between SQLite and PostgreSQL.
 *
 * - Development: Uses better-sqlite3 (SQLite, file-based, synchronous)
 * - Production: Uses pg (PostgreSQL, when DATABASE_URL is set)
 *
 * Both adapters expose the same prepare/run/get/all interface,
 * though PostgreSQL operations are async.
 *
 * @module server/db
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const USE_PG = !!process.env.DATABASE_URL;

let db;

if (USE_PG) {
  // ── PostgreSQL (production) ──
  const { createPostgresAdapter } = await import('./db-postgres.js');
  db = createPostgresAdapter(process.env.DATABASE_URL);
  console.log('[DB] Using PostgreSQL');

  // Initialize schema
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_guest INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#0ea5e9',
      user_id INTEGER,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'todo' CHECK(status IN ('todo','inprogress','done')),
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low','medium','high','urgent')),
      label TEXT DEFAULT '',
      due_date TEXT,
      project_id INTEGER,
      user_id INTEGER,
      position INTEGER DEFAULT 0,
      recurrence_rule TEXT DEFAULT NULL,
      recurrence_parent_id INTEGER DEFAULT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS subtasks (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      position INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      task_id INTEGER,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL,
      user_id INTEGER,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default project
  try {
    const existing = await db.prepare('SELECT id FROM projects WHERE id = $1').get(1);
    if (!existing) {
      await db.prepare("INSERT INTO projects (name, color) VALUES ($1, $2)").run('My Project', '#0ea5e9');
    }
  } catch { /* noop */ }

  console.log('[DB] PostgreSQL schema initialized');

} else {
  // ── SQLite (development) ──
  const dbDir = join(__dirname, 'data');
  mkdirSync(dbDir, { recursive: true });

  db = new Database(join(dbDir, 'taskflow.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#0ea5e9',
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'todo' CHECK(status IN ('todo','inprogress','done')),
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low','medium','high','urgent')),
      label TEXT DEFAULT '',
      due_date TEXT,
      project_id INTEGER,
      user_id INTEGER,
      position INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    INSERT OR IGNORE INTO projects (id, name, color) VALUES (1, 'My Project', '#0ea5e9');

    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      position INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      user_id INTEGER,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  // SQLite migrations for existing databases
  const migrations = [
    { check: "SELECT due_date FROM tasks LIMIT 1", sql: "ALTER TABLE tasks ADD COLUMN due_date TEXT" },
    { check: "SELECT user_id FROM tasks LIMIT 1", sql: "ALTER TABLE tasks ADD COLUMN user_id INTEGER" },
    { check: "SELECT user_id FROM projects LIMIT 1", sql: "ALTER TABLE projects ADD COLUMN user_id INTEGER" },
    { check: "SELECT user_id FROM activity_log LIMIT 1", sql: "ALTER TABLE activity_log ADD COLUMN user_id INTEGER" },
    { check: "SELECT is_guest FROM users LIMIT 1", sql: "ALTER TABLE users ADD COLUMN is_guest INTEGER DEFAULT 0" },
    { check: "SELECT recurrence_rule FROM tasks LIMIT 1", sql: "ALTER TABLE tasks ADD COLUMN recurrence_rule TEXT DEFAULT NULL" },
    { check: "SELECT recurrence_parent_id FROM tasks LIMIT 1", sql: "ALTER TABLE tasks ADD COLUMN recurrence_parent_id INTEGER DEFAULT NULL" },
  ];

  for (const m of migrations) {
    try { db.prepare(m.check).get(); }
    catch { db.exec(m.sql); }
  }

  console.log('[DB] Using SQLite — schema version 3');
}

export default db;
