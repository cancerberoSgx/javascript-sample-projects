import { NextFunction, Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { inject } from 'inversify'
import { controller, httpPost } from 'inversify-express-utils'
import { InvalidParameterError } from '../../errors'
import { AuthService } from './authService'
import { LoginOutput } from './authTypes'

@controller('/auth')
export class AuthController {
  constructor(@inject('AuthService') private authService: AuthService) {}

  /**
   * @api {post} /login Login
   * @apiDescription Login
   * @apiName Login
   * @apiGroup Auth
   *
   * @apiHeader Content-type              application/json
   * @apiHeader Authentication            Authentication token
   *
   * @apiParam {string}   email
   * @apiParam {string}   password
   *
   * @apiSuccess {boolean} id        user id
   *
   * @apiSuccessExample {json} Success-Response:
   * TODO
   **/
  @httpPost(
    '/login',
    body('email', 'email should be a string').isString().exists(),
    body('password', 'password should be a string').isString().exists()
  )
  public async login(req: Request, res: Response, next: NextFunction): Promise<LoginOutput> {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new InvalidParameterError(errors.array()[0]['msg'])
      }
      const { email, password } = req.body
      const result = await this.authService.login({ email, password })
      return result
    } catch (err) {
      next(err)
    }
  }
}
