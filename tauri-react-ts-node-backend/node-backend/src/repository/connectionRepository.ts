import { getDb } from '../db';

export interface Connection {
  id: number;
  profile_id: number;
  name: string;
  db_host: string;
  db_port: number;
  db_name: string;
  db_user: string;
  db_password: string;
}

export type ConnectionInput = Omit<Connection, 'id' | 'profile_id'>;

export function listConnections(profileId: number): Connection[] {
  return getDb()
    .prepare('SELECT * FROM connections WHERE profile_id = ? ORDER BY name')
    .all(profileId) as unknown as Connection[];
}

export function createConnection(profileId: number, input: ConnectionInput): Connection {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO connections (profile_id, name, db_host, db_port, db_name, db_user, db_password)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(profileId, input.name, input.db_host, input.db_port, input.db_name, input.db_user, input.db_password);

  return db
    .prepare('SELECT * FROM connections WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as unknown as Connection;
}

export function updateConnection(id: number, profileId: number, input: ConnectionInput): Connection | null {
  const db = getDb();

  const exists = db
    .prepare('SELECT 1 FROM connections WHERE id = ? AND profile_id = ?')
    .get(id, profileId);
  if (!exists) return null;

  db.prepare(`
    UPDATE connections
    SET name = ?, db_host = ?, db_port = ?, db_name = ?, db_user = ?, db_password = ?
    WHERE id = ? AND profile_id = ?
  `).run(input.name, input.db_host, input.db_port, input.db_name, input.db_user, input.db_password, id, profileId);

  return db
    .prepare('SELECT * FROM connections WHERE id = ?')
    .get(id) as unknown as Connection;
}
