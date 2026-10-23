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
