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
}
