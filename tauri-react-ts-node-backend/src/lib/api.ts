import { apiUrl, authHeaders, BackendInfo } from './backend';

export interface Profile {
  id: number;
  name: string;
}

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
