import { getDb } from '../db';

export interface Script {
  id: number;
  connection_id: number;
  name: string;
  content: string;
}

export type ScriptInput = Pick<Script, 'name' | 'content'>;

export function listScripts(connectionId: number): Script[] {
  return getDb()
    .prepare('SELECT * FROM scripts WHERE connection_id = ? ORDER BY name')
    .all(connectionId) as unknown as Script[];
}

export function getScript(id: number, connectionId: number): Script | null {
  return getDb()
    .prepare('SELECT * FROM scripts WHERE id = ? AND connection_id = ?')
    .get(id, connectionId) as unknown as Script | null;
}

export function createScript(connectionId: number, input: ScriptInput): Script {
  const db = getDb();
  const result = db
    .prepare('INSERT INTO scripts (connection_id, name, content) VALUES (?, ?, ?)')
    .run(connectionId, input.name, input.content);
  return db
    .prepare('SELECT * FROM scripts WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as unknown as Script;
}

export function updateScript(id: number, connectionId: number, input: ScriptInput): Script | null {
  const db = getDb();
  const exists = db
    .prepare('SELECT 1 FROM scripts WHERE id = ? AND connection_id = ?')
    .get(id, connectionId);
  if (!exists) return null;
  db.prepare('UPDATE scripts SET name = ?, content = ? WHERE id = ? AND connection_id = ?')
    .run(input.name, input.content, id, connectionId);
  return db
    .prepare('SELECT * FROM scripts WHERE id = ?')
    .get(id) as unknown as Script;
}

export function deleteScript(id: number, connectionId: number): boolean {
  const result = getDb()
    .prepare('DELETE FROM scripts WHERE id = ? AND connection_id = ?')
    .run(id, connectionId);
  return result.changes > 0;
}
