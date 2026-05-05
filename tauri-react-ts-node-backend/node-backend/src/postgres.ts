import { Pool, PoolConfig, QueryResult } from 'pg';
import { Connection } from './repository/connectionRepository';

// One pool per saved connection, keyed by connection.id.
// Pools are created lazily on first use and reused across requests.
const pools = new Map<number, Pool>();

export type QueryRow = Record<string, unknown>;

function buildConfig(conn: Connection): PoolConfig {
  return {
    host: conn.db_host,
    port: conn.db_port,
    database: conn.db_name,
    user: conn.db_user,
    password: conn.db_password,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    // Lets the Node process exit cleanly when all pools are idle.
    allowExitOnIdle: true,
  };
}

export function getPool(conn: Connection): Pool {
  console.log('GET POOL ', conn);
  
  const existing = pools.get(conn.id);
  if (existing) return existing;

  const pool = new Pool(buildConfig(conn));

  pool.on('error', (err: Error) => {
    console.error(`[postgres] pool error on connection ${conn.id} (${conn.name}):`, err.message);
  });

  pools.set(conn.id, pool);
  return pool;
}

/**
 * Run an arbitrary SQL statement against a saved connection.
 * params are positional ($1, $2, …) following standard PostgreSQL syntax.
 */
export async function runQuery(
  conn: Connection,
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult<QueryRow>> {
  const pool = getPool(conn);
  // pg types values as any[]; cast is safe here — callers own their param types
  return pool.query<QueryRow>(sql, params as unknown as never[]);
}

/**
 * Open and immediately release a connection to verify credentials/reachability.
 * Throws if the connection cannot be established.
 */
export async function testConnection(conn: Connection): Promise<void> {
  const pool = getPool(conn);
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}

/**
 * Drain and remove the pool for a specific connection.
 * Call this when a connection is edited or deleted so stale credentials
 * are not reused.
 */
export async function closePool(connectionId: number): Promise<void> {
  const pool = pools.get(connectionId);
  if (!pool) return;
  pools.delete(connectionId);
  await pool.end();
}

/**
 * Drain all pools.  Call on server shutdown for a clean exit.
 */
export async function closeAllPools(): Promise<void> {
  const all = [...pools.values()];
  pools.clear();
  await Promise.all(all.map((p) => p.end()));
}
