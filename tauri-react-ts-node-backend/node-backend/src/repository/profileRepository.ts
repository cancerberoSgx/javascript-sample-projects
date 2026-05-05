import { getDb } from '../db';

export interface Profile {
  id: number;
  name: string;
}

export function listProfiles(): Profile[] {
  return getDb()
    .prepare('SELECT * FROM profiles ORDER BY name')
    .all() as unknown as Profile[];
}

export function getProfile(id: number): Profile | null {
  const row = getDb().prepare('SELECT * FROM profiles WHERE id = ?').get(id);
  return row ? (row as unknown as Profile) : null;
}

export function createProfile(name: string): Profile {
  const db = getDb();
  const result = db.prepare('INSERT INTO profiles (name) VALUES (?)').run(name);
  return db
    .prepare('SELECT * FROM profiles WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as unknown as Profile;
}

export function updateProfile(id: number, name: string): Profile | null {
  const db = getDb();
  const exists = db.prepare('SELECT 1 FROM profiles WHERE id = ?').get(id);
  if (!exists) return null;
  db.prepare('UPDATE profiles SET name = ? WHERE id = ?').run(name, id);
  return db.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as unknown as Profile;
}

export function deleteProfile(id: number): boolean {
  const result = getDb().prepare('DELETE FROM profiles WHERE id = ?').run(id);
  return Number(result.changes) > 0;
}
