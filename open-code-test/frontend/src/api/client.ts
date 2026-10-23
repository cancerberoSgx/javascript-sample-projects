import type {
  CopyDriveItemsInput,
  CreateDriveItemInput,
  CreateFileInput,
  CreateUserInput,
  Drive,
  DriveItem,
  DriveItemDetail,
  LoginResponse,
  Organization,
  UpdateDriveItemInput,
  UpdateUserInput,
  User,
} from '../types'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'
const TOKEN_KEY = 'orgmanager_token'
const IMPERSONATOR_KEY = 'orgmanager_impersonator'

export interface ImpersonatorSession {
  token: string
  user: User
  targetUserId: number
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function getImpersonatorSession(): ImpersonatorSession | null {
  const stored = localStorage.getItem(IMPERSONATOR_KEY)
  if (!stored) {
    return null
  }

  try {
    const session = JSON.parse(stored) as Partial<ImpersonatorSession> | null
    if (
      session &&
      typeof session.token === 'string' &&
      session.user &&
      session.user.role === 'root' &&
      typeof session.targetUserId === 'number'
    ) {
      return session as ImpersonatorSession
    }
  } catch {
    // Ignore malformed data and treat it as no active impersonation.
  }

  localStorage.removeItem(IMPERSONATOR_KEY)
  return null
}

export function setImpersonatorSession(session: ImpersonatorSession): void {
  localStorage.setItem(IMPERSONATOR_KEY, JSON.stringify(session))
}

export function clearImpersonatorSession(): void {
  localStorage.removeItem(IMPERSONATOR_KEY)
}

function extractDetail(data: unknown, status: number): string {
  if (data && typeof data === 'object' && 'detail' in data) {
    const detail = (data as { detail: unknown }).detail
    if (typeof detail === 'string') {
      return detail
    }
    if (Array.isArray(detail)) {
      const messages = detail.map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) {
          return String((item as { msg: unknown }).msg)
        }
        return String(item)
      })
      if (messages.length > 0) {
        return messages.join('. ')
      }
    }
  }
  return `Request failed with status ${status}`
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers = new Headers(options.headers)

  if (
    options.body !== undefined &&
    !(options.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (response.status === 401 && token) {
    window.dispatchEvent(new Event('auth:unauthorized'))
  }

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  if (!response.ok) {
    throw new ApiError(response.status, extractDetail(data, response.status))
  }

  return data as T
}

function filenameFromDisposition(header: string | null): string | null {
  const utf8Match = header?.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      // Fall through to the plain filename.
    }
  }
  return header?.match(/filename="([^"]+)"/i)?.[1] ?? null
}

export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<User>('/auth/me'),

  listOrganizations: () => request<Organization[]>('/organizations'),

  getOrganization: (organizationId: number) =>
    request<Organization>(`/organizations/${organizationId}`),

  createOrganization: (name: string) =>
    request<Organization>('/organizations', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  updateOrganization: (organizationId: number, name: string) =>
    request<Organization>(`/organizations/${organizationId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  deleteOrganization: (organizationId: number) =>
    request<void>(`/organizations/${organizationId}`, { method: 'DELETE' }),

  listUsers: (organizationId: number) =>
    request<User[]>(`/organizations/${organizationId}/users`),

  createUser: (organizationId: number, data: CreateUserInput) =>
    request<User>(`/organizations/${organizationId}/users`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateUser: (organizationId: number, userId: number, data: UpdateUserInput) =>
    request<User>(`/organizations/${organizationId}/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteUser: (organizationId: number, userId: number) =>
    request<void>(`/organizations/${organizationId}/users/${userId}`, {
      method: 'DELETE',
    }),

  impersonateUser: (organizationId: number, userId: number) =>
    request<LoginResponse>(
      `/organizations/${organizationId}/users/${userId}/impersonate`,
      { method: 'POST' },
    ),

  listDrives: (organizationId: number) =>
    request<Drive[]>(`/organizations/${organizationId}/drives`),

  createDrive: (organizationId: number, name: string) =>
    request<Drive>(`/organizations/${organizationId}/drives`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  getDrive: (organizationId: number, driveId: number) =>
    request<Drive>(`/organizations/${organizationId}/drives/${driveId}`),

  updateDrive: (organizationId: number, driveId: number, name: string) =>
    request<Drive>(`/organizations/${organizationId}/drives/${driveId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  deleteDrive: (organizationId: number, driveId: number) =>
    request<void>(`/organizations/${organizationId}/drives/${driveId}`, {
      method: 'DELETE',
    }),

  listDriveItems: (organizationId: number, driveId: number) =>
    request<DriveItem[]>(
      `/organizations/${organizationId}/drives/${driveId}/items`,
    ),

  getDriveItem: (organizationId: number, driveId: number, itemId: number) =>
    request<DriveItemDetail>(
      `/organizations/${organizationId}/drives/${driveId}/items/${itemId}`,
    ),

  createFolder: (
    organizationId: number,
    driveId: number,
    data: CreateDriveItemInput,
  ) =>
    request<DriveItem>(
      `/organizations/${organizationId}/drives/${driveId}/folders`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    ),

  createFile: (organizationId: number, driveId: number, data: CreateFileInput) =>
    request<DriveItem>(
      `/organizations/${organizationId}/drives/${driveId}/files`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    ),

  uploadFile: (
    organizationId: number,
    driveId: number,
    file: File,
    parentId: number | null,
  ) => {
    const form = new FormData()
    form.append('file', file)
    if (parentId !== null) {
      form.append('parent_id', String(parentId))
    }
    return request<DriveItem>(
      `/organizations/${organizationId}/drives/${driveId}/files/upload`,
      {
        method: 'POST',
        body: form,
      },
    )
  },

  downloadFile: async (
    organizationId: number,
    driveId: number,
    itemId: number,
  ): Promise<{ blob: Blob; filename: string }> => {
    const token = getToken()
    const headers = new Headers()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    const response = await fetch(
      `${API_BASE}/organizations/${organizationId}/drives/${driveId}/items/${itemId}/download`,
      { headers },
    )

    if (response.status === 401 && token) {
      window.dispatchEvent(new Event('auth:unauthorized'))
    }

    if (!response.ok) {
      const text = await response.text()
      let data: unknown = null
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        data = null
      }
      throw new ApiError(response.status, extractDetail(data, response.status))
    }

    return {
      blob: await response.blob(),
      filename:
        filenameFromDisposition(response.headers.get('Content-Disposition')) ??
        'download',
    }
  },

  updateDriveItem: (
    organizationId: number,
    driveId: number,
    itemId: number,
    data: UpdateDriveItemInput,
  ) =>
    request<DriveItem>(
      `/organizations/${organizationId}/drives/${driveId}/items/${itemId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
    ),

  updateFileContent: (
    organizationId: number,
    driveId: number,
    itemId: number,
    content: string,
  ) =>
    request<DriveItemDetail>(
      `/organizations/${organizationId}/drives/${driveId}/items/${itemId}/content`,
      {
        method: 'PUT',
        body: JSON.stringify({ content }),
      },
    ),

  deleteDriveItem: (
    organizationId: number,
    driveId: number,
    itemId: number,
  ) =>
    request<void>(
      `/organizations/${organizationId}/drives/${driveId}/items/${itemId}`,
      { method: 'DELETE' },
    ),

  copyDriveItems: (
    organizationId: number,
    driveId: number,
    data: CopyDriveItemsInput,
  ) =>
    request<DriveItem[]>(
      `/organizations/${organizationId}/drives/${driveId}/items/copy`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    ),
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return 'Something went wrong'
}
