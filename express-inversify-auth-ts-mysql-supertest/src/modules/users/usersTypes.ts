export interface CreateUserInput {
  name: string
  email: string
  password: string
}
export interface CreateUserResult {
  id: number
}
/** User object returned to client */
export interface User {
  id: number
  email: string
  name: string
}
