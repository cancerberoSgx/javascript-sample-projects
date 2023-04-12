import { IAuthenticationService } from './IAuthenticationService';
import { injectable } from 'inversify';
// import { contextLogger, flowLogger } from '../../../factory/logger';
// import { JWTAuthenticationService } from './JWTAuthenticationService';
// import { Logger } from 'winston';

// const logger: Logger = contextLogger(flowLogger);

/**
 * This class is an "authentication proxy" for unit tests that use an authentication
 * model where tokens and users are equivalent.
 * New tests must base its authentication procedure on Cognito, using for that
 * the facilities located in 'test/helpers/cognito.ts'
 */
@injectable()
export class TestAuthenticationService implements IAuthenticationService {
  constructor(
    // private cognitoAuthService: JWTAuthenticationService = new JWTAuthenticationService()
  ) {
    // logger.warn('Using test authentication service.');
  }

  /**
   * Extract the user information from the access token.
   * @param authToken
   * @param apiKey
   */
  public async getUserFromAccessToken(authToken: string): Promise<string> {
    // Fake token or a valid one for Cognito?
    // if (authToken.length < 100) {
      // fake token is equivalent to its associated user
      return authToken;
    // } else return this.cognitoAuthService.getUserFromAccessToken(authToken);
  }
}
