export type Role = 'member' | 'root'

export interface User {
  id: number
  organization_id: number
  email: string
  role: Role
  created_at: string
  updated_at: string
}

export interface Organization {
  id: number
  name: string
  created_at: string
  updated_at: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: User
}

export interface CreateUserInput {
  email: string
  password: string
  role: Role
}

export interface UpdateUserInput {
  email?: string
  password?: string
  role?: Role
}

export interface Drive {
  id: number
  organization_id: number
  name: string
  created_at: string
  updated_at: string
}

export type DriveItemKind = 'folder' | 'file'

export interface DriveItem {
  id: number
  drive_id: number
  parent_id: number | null
  kind: DriveItemKind
  name: string
  file_type: string | null
  size_bytes: number
  created_at: string
  updated_at: string
}

export interface DriveItemDetail extends DriveItem {
  content: string | null
}

export interface CreateDriveItemInput {
  name: string
  parent_id: number | null
}

export interface CreateFileInput extends CreateDriveItemInput {
  content?: string
}

export interface UpdateDriveItemInput {
  name?: string
  parent_id?: number | null
}

export interface CopyDriveItemsInput {
  item_ids: number[]
  target_parent_id: number | null
}
