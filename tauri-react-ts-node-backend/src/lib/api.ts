import { apiUrl, authHeaders, BackendInfo } from './backend';

export interface Profile {
  id: number;
  name: string;
}

export interface Connection {
  id: number;
  profile_id: number;
  type: string;
  name: string;
  db_host: string;
  db_port: number;
  db_name: string;
  db_user: string;
  db_password: string;
}

export type ConnectionInput = Omit<Connection, 'id' | 'profile_id'>;

async function request<T>(url: string, init: RequestInit, info: BackendInfo): Promise<T> {
  const res = await fetch(url, { ...init, headers: authHeaders(info) });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json();
  return data as T;
}

export const profilesApi = {
  list: (info: BackendInfo) =>
    request<Profile[]>(apiUrl('/api/profiles', info), {}, info),

  create: (name: string, info: BackendInfo) =>
    request<Profile>(apiUrl('/api/profiles', info), {
      method: 'POST',
      body: JSON.stringify({ name }),
    }, info),

  update: (id: number, name: string, info: BackendInfo) =>
    request<Profile>(apiUrl(`/api/profiles/${id}`, info), {
      method: 'PUT',
      body: JSON.stringify({ name }),
    }, info),

  delete: (id: number, info: BackendInfo) =>
    request<unknown>(apiUrl(`/api/profiles/${id}`, info), { method: 'DELETE' }, info),
};

export interface TableInfo {
  schema: string;
  name: string;
  type: string;
}

export interface FieldInfo {
  name: string;
  ordinal_position: number;
  data_type: string;
  native_type?: string;
  nullable: boolean;
  default_value: string | null;
  max_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  is_primary_key: boolean;
}

export const connectionsApi = {
  list: (profileId: number, info: BackendInfo) =>
    request<Connection[]>(apiUrl(`/api/profiles/${profileId}/connections`, info), {}, info),

  create: (profileId: number, input: ConnectionInput, info: BackendInfo) =>
    request<Connection>(
      apiUrl(`/api/profiles/${profileId}/connections`, info),
      { method: 'POST', body: JSON.stringify(input) },
      info,
    ),

  update: (id: number, profileId: number, input: ConnectionInput, info: BackendInfo) =>
    request<Connection>(
      apiUrl(`/api/profiles/${profileId}/connections/${id}`, info),
      { method: 'PUT', body: JSON.stringify(input) },
      info,
    ),
};

export type FilterOp = 'eq' | 'lt' | 'gt' | 'lte' | 'gte' | 'like' | 'ilike';

export interface FilterClause {
  column: string;
  op: FilterOp;
  value: string;
}

export interface SortClause {
  column: string;
  direction: 'asc' | 'desc';
}

export interface TableDataOptions {
  schema?: string;
  filters?: FilterClause[];
  sort?: SortClause;
  limit?: number;
  offset?: number;
}

export interface TableDataResult {
  rows: Record<string, unknown>[];
  total: number;
  columns: string[];
}

export const tablesApi = {
  list: (connectionId: number, info: BackendInfo) =>
    request<TableInfo[]>(apiUrl(`/api/connections/${connectionId}/tables`, info), {}, info),

  getFields: (connectionId: number, tableName: string, schema: string | undefined, info: BackendInfo) => {
    const base = apiUrl(`/api/connections/${connectionId}/tables/${encodeURIComponent(tableName)}/fields`, info);
    const url = schema ? `${base}?schema=${encodeURIComponent(schema)}` : base;
    return request<FieldInfo[]>(url, {}, info);
  },

  getData: (connectionId: number, tableName: string, options: TableDataOptions = {}, info: BackendInfo) => {
    const base = apiUrl(`/api/connections/${connectionId}/tables/${encodeURIComponent(tableName)}/data`, info);
    const params = new URLSearchParams();
    if (options.schema) params.set('schema', options.schema);
    if (options.sort) {
      params.set('sort_col', options.sort.column);
      params.set('sort_dir', options.sort.direction);
    }
    if (options.filters?.length) {
      options.filters.forEach((f) => {
        params.append('filter_col', f.column);
        params.append('filter_op', f.op);
        params.append('filter_val', f.value);
      });
    }
    if (options.limit !== undefined) params.set('limit', String(options.limit));
    if (options.offset !== undefined) params.set('offset', String(options.offset));
    const url = params.toString() ? `${base}?${params}` : base;
    return request<TableDataResult>(url, {}, info);
  },
};
