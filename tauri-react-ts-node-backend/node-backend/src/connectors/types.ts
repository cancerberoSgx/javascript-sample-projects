export interface TableInfo {
  schema: string;
  name: string;
  type: string; // 'BASE TABLE' | 'VIEW' | db-specific variants
}

export interface FieldInfo {
  name: string;
  ordinal_position: number;
  data_type: string;       // standard SQL type name
  native_type?: string;    // db-specific underlying type (e.g. pg udt_name)
  nullable: boolean;
  default_value: string | null;
  max_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  is_primary_key: boolean;
}

// ── Query result types ────────────────────────────────────────────────────────

/** Metadata for a single column as returned from the wire protocol. */
export interface ColumnMeta {
  name: string;
  /** Wire-protocol type code — Postgres OID, MySQL field type, etc. Optional so
   *  connectors without a meaningful equivalent can omit it. */
  data_type_id?: number;
}

/** Result of a SELECT / EXPLAIN / SHOW statement — carries rows and column metadata. */
export interface SelectResult {
  type: 'select';
  fields: ColumnMeta[];
  rows: Record<string, unknown>[];
  row_count: number;
}

/** Result of a data-mutation statement: INSERT, UPDATE, DELETE, MERGE. */
export interface MutationResult {
  type: 'mutation';
  command: string;
  affected_rows: number;
}

/** Result of a DDL or control statement: CREATE, DROP, ALTER, TRUNCATE,
 *  BEGIN, COMMIT, ROLLBACK, … */
export interface DDLResult {
  type: 'ddl';
  command: string;
}

export type QueryResult = SelectResult | MutationResult | DDLResult;

// ── Connector interface ───────────────────────────────────────────────────────

/**
 * Generic interface every connector must implement.
 * Each connection type (postgres, mysql, sqlite, …) has its own class
 * that satisfies this contract.
 */
export interface IConnector {
  /** List all non-system tables and views accessible on this connection. */
  getTables(): Promise<TableInfo[]>;

  /**
   * Return column metadata for a specific table.
   * @param tableName  Name of the table/view.
   * @param schema     Schema (or database) name — connector uses a sensible
   *                   default when omitted (e.g. 'public' for Postgres).
   */
  getTableFields(tableName: string, schema?: string): Promise<FieldInfo[]>;

  /**
   * Execute an arbitrary SQL statement and return a typed result that reflects
   * what kind of command was run (SELECT, mutation, DDL, …).
   */
  executeQuery(sql: string): Promise<QueryResult>;
}
