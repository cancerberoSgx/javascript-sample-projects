import { inject, injectable } from 'inversify'
import { Pool } from 'mysql'
import { MySQLRepository } from '../../MySQLRepository'

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

  public async health(): Promise<boolean> {
    await this._doQuery('SELECT TRUE', [])
    return true
  }
}
