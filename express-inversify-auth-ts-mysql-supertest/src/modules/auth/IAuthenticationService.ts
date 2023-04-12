export interface IAuthenticationService {
  /**
   * Extract the user information from access token.
   * @param accessToken
   * @param apiKey
   */
  getUserFromAccessToken(accessToken: string): Promise<string>;
}
