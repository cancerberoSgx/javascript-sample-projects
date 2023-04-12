import { NextFunction, Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { inject } from 'inversify'
import { controller, httpPost } from 'inversify-express-utils'
import { InvalidParameterError } from '../../errors'
import { UsersService } from './usersService'

@controller('/users')
export class UsersController {
  constructor(@inject('UsersService') private usersService: UsersService) {}

  /**
   * @api {post} /users Create new user
   * @apiDescription Create new user
   * @apiName Create new user
   * @apiGroup Users
   *
   * @apiHeader Content-type              application/json
   * @apiHeader Authentication            Authentication token
   *
   * @apiParam {string}   name
   * @apiParam {string}   email
   * @apiParam {string}   password
   *
   * @apiSuccess {boolean} id        user id
   *
   * @apiSuccessExample {json} Success-Response:
   * {"id": 12}
   **/
  @httpPost(
    '/',
    body('name', 'name should be a string').isString().exists(),
    body('email', 'email should be a string').isString().exists(),
    body('password', 'password should be a string').isString().exists()
  )
  public async createUser(req: Request, res: Response, next: NextFunction): Promise<{ id: string }> {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new InvalidParameterError(errors.array()[0]['msg'])
      }
      const { name, email, password } = req.body
      const result = await this.usersService.createUser({ name, email, password })
      return result
    } catch (err) {
      next(err)
    }
  }
}
