import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const DB_DIR = path.join(os.homedir(), '.my_db_inspector');
const DB_PATH = path.join(DB_DIR, 'data');
const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');

let _db: DatabaseSync | null = null;

export function initDb(): void {
  fs.mkdirSync(DB_DIR, { recursive: true });

  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  runMigrations(db);
  _db = db;
}

export function getDb(): DatabaseSync {
  if (!_db) throw new Error('Database not initialized');
  return _db;
}

function runMigrations(db: DatabaseSync): void {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const already = db.prepare('SELECT 1 FROM schema_migrations WHERE name = ?').get(file);
    if (already) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    db.exec(sql);
    db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file);
    console.error(`[db] Applied migration: ${file}`);
  }
}
