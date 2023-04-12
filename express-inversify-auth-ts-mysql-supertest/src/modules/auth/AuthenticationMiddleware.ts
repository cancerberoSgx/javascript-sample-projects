import { NextFunction, Request, Response } from 'express';
import { BaseMiddleware } from 'inversify-express-utils';
import { inject, injectable } from 'inversify';
import { IAuthenticationService } from './IAuthenticationService';
import {AuthenticationError} from '../../errors';

@injectable()
export class AuthenticationMiddleware extends BaseMiddleware {
  constructor(
    @inject('IAuthenticationService')
    private authenticationService: IAuthenticationService
  ) {
    super();
  }

  /**
   * Authentication middleware to verify the user token.
   * It throws an AuthenticationError when the token can not be validated.
   */
  public async handler(req: Request, res: Response, next: NextFunction) {
    try {
      let authToken = req.header('Authentication');
      if (!authToken) {
        throw new AuthenticationError('Authentication token is missing');
      }
      req.body.userId = await this.authenticationService.getUserFromAccessToken(authToken);
      next();
    } catch (e) {
      next(new AuthenticationError(`Unauthorized user: ${e.message}`));
    }
  }
}

export const AuthMiddlewareSymbol = Symbol.for('AuthenticationMiddleware');
