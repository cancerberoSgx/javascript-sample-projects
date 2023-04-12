import 'reflect-metadata'
import { inject, injectable } from 'inversify'
import { AuthService } from './authService'
import * as jwt from 'jsonwebtoken'
import { LoginInput, LoginOutput } from './authTypes'
import { UsersStorage } from '../users/usersStorage'
import { compare, signToken } from './authUtil'
import { AuthenticationError } from '../../errors'

/**
 * jsonwebtoken based auth
 */
@injectable()
export class JWTAuthService implements AuthService {
  constructor(@inject('UsersStorage') private usersStorage: UsersStorage) {}

  async getUserFromAccessToken(accessToken: string): Promise<string> {
    try {
      const decodedToken = jwt.verify(accessToken, process.env.JWT_SECRET)
      return (decodedToken as any).id
    } catch (error) {
      throw new AuthenticationError(error)
    }
  }

  public async login(arg: LoginInput): Promise<LoginOutput> {
    const user = await this.usersStorage.getUserByEmail(arg.email)
    await compare(arg.password, user.password)
    const token = signToken(user.id, user.email)
    delete user.password
    return {
      ...user,
      token,
    }
  }
}
