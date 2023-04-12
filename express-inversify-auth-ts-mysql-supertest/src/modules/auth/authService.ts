import { LoginInput, LoginOutput } from './authTypes'

export interface AuthService {
  login(arg: LoginInput): Promise<LoginOutput>
  /**
   * Extract the user information from access token.
   * @param accessToken
   * @param apiKey
   */
  getUserFromAccessToken(accessToken: string): Promise<string>
}
