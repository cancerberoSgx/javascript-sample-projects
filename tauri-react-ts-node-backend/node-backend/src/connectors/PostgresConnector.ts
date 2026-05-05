import { Pool } from 'pg';
import { getPool } from '../postgres';
import { Connection } from '../repository/connectionRepository';
import {
  ColumnMeta,
  DDLResult,
  FieldInfo,
  IConnector,
  MutationResult,
  QueryResult,
  SelectResult,
  TableInfo,
} from './types';

/**
 * Classify a PostgreSQL command tag into the three broad categories used by
 * QueryResult.  The tag may include extra words (e.g. "CREATE TABLE",
 * "INSERT 0 5") so we test with startsWith rather than strict equality.
 */
function classifyCommand(tag: string): 'select' | 'mutation' | 'ddl' {
  if (['SELECT', 'EXPLAIN', 'SHOW'].some((p) => tag.startsWith(p))) return 'select';
  if (['INSERT', 'UPDATE', 'DELETE', 'MERGE'].some((p) => tag.startsWith(p))) return 'mutation';
  return 'ddl';
}

export class PostgresConnector implements IConnector {
  private readonly pool: Pool;

  constructor(conn: Connection) {
    this.pool = getPool(conn);
  }

  async getTables(): Promise<TableInfo[]> {
    const { rows } = await this.pool.query<TableInfo>(`
      SELECT
        table_schema AS schema,
        table_name   AS name,
        table_type   AS type
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        AND table_schema NOT LIKE 'pg_%'
      ORDER BY table_schema, table_name
    `);
    return rows;
  }

  async getTableFields(tableName: string, schema = 'public'): Promise<FieldInfo[]> {
    const { rows } = await this.pool.query<FieldInfo>(`
      SELECT
        c.column_name                AS name,
        c.ordinal_position,
        c.data_type,
        c.udt_name                   AS native_type,
        (c.is_nullable = 'YES')      AS nullable,
        c.column_default             AS default_value,
        c.character_maximum_length   AS max_length,
        c.numeric_precision,
        c.numeric_scale,
        EXISTS (
          SELECT 1
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage  kcu
            ON  tc.constraint_name = kcu.constraint_name
            AND tc.table_schema    = kcu.table_schema
            AND tc.table_name      = kcu.table_name
          WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_schema    = c.table_schema
            AND tc.table_name      = c.table_name
            AND kcu.column_name    = c.column_name
        )                            AS is_primary_key
      FROM information_schema.columns c
      WHERE c.table_schema = $1
        AND c.table_name   = $2
      ORDER BY c.ordinal_position
    `, [schema, tableName]);
    return rows;
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    const result = await this.pool.query(sql);
    const command = (result.command ?? '').toUpperCase();

    switch (classifyCommand(command)) {
      case 'select': {
        const fields: ColumnMeta[] = result.fields.map((f) => ({
          name: f.name,
          data_type_id: f.dataTypeID,
        }));
        return {
          type: 'select',
          fields,
          rows: result.rows as Record<string, unknown>[],
          row_count: result.rows.length,
        } satisfies SelectResult;
      }

      case 'mutation':
        return {
          type: 'mutation',
          command,
          affected_rows: result.rowCount ?? 0,
        } satisfies MutationResult;

      default:
        return { type: 'ddl', command } satisfies DDLResult;
    }
  }
}
