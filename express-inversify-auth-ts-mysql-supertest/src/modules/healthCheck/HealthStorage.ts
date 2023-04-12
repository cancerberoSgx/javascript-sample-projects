import { inject, injectable } from 'inversify'
import { Pool } from 'mysql'
import { MySQLRepository } from '../../MySQLRepository'

@injectable()
export class HealthStorage extends MySQLRepository {
  constructor(@inject('DBPool') mysqlPool: Pool) {
    super(mysqlPool)
  }

  public async health(): Promise<boolean> {
    await this._doQuery('SELECT TRUE', [])
    return true
  }
}
