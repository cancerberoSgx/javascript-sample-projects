import { inject, injectable } from 'inversify'
import { Pool } from 'mysql'
import { MySQLRepository } from '../../MySQLRepository'
import { User } from './usersTypes'

@injectable()
export class UsersStorage extends MySQLRepository {
  constructor(@inject('DBPool') mysqlPool: Pool) {
    super(mysqlPool)
  }

  async createUser(args: { name: string; email: string; password: string }) {
    const result = await this._doQuery('insert into users (name, email, password) values (:name, :email, :password)', args)
    //@ts-ignore
    return result.insertId
  }

  async getUserByEmail(email: string): Promise<User & { password: string }> {
    const result = await this._doQuery('SELECT id, name, email, password FROM users WHERE email = :email', { email })
    return result[0]
  }
}
