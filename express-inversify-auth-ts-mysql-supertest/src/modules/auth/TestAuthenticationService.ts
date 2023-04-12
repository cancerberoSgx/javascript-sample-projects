import { AuthService } from './authService'
import { injectable } from 'inversify'
import { LoginInput, LoginOutput } from './authTypes'
/**
 * This class is an "authentication proxy" for unit tests that use an authentication
 * model where tokens and users are equivalent.
 * New tests must base its authentication procedure on Cognito, using for that
 * the facilities located in 'test/helpers/cognito.ts'
 */
@injectable()
export class TestAuthService implements AuthService {
  public async login(arg: LoginInput): Promise<LoginOutput> {
    throw new Error('Method not implemented.')
  }
  public async getUserFromAccessToken(authToken: string): Promise<string> {
    return authToken
  }
}
