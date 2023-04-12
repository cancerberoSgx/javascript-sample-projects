import { User } from '../users/usersTypes'

export interface LoginInput {
  email: string
  password: string
}
export interface LoginOutput extends User {
  token: string
}
