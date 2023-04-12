import { injectable } from 'inversify'
import { Pool, PoolConnection } from 'mysql'
import 'reflect-metadata'
import { formatQuery } from './helpers/FormattedQuery'
import { printSQLQuery } from './helpers/Util'

type QueryParams = { [key: string]: any }

@injectable()
export abstract class MySQLRepository {
  public constructor(protected mysqlPool: Pool) {}

  protected async _getConnection(): Promise<PoolConnection> {
    return new Promise<PoolConnection>((resolve, reject) => {
      this.mysqlPool.getConnection((err, connection) => {
        if (err) return reject(err)
        resolve(connection)
      })
    })
  }

  async _queryHelper(connection: PoolConnection, query: string, params: any[]): Promise<any[]> {
    return new Promise<any[]>((resolve, reject) => {
      connection.query(query, params, (error, results, fields) => {
        if (error) {
          return reject(error)
        }
        resolve(results)
      })
    })
  }

  protected async _doQuery(query: string, params?: any[] | QueryParams): Promise<any[]> {
    const connection: PoolConnection = await this._getConnection()
    try {
      if (Array.isArray(params)) {
        return await this._queryHelper(connection, /*queryLogger(),*/ query, params || [])
      } else {
        return await this._doFormattedQuery(query, params || {})
      }
    } finally {
      connection.release()
    }
  }

  /** useful to debug executed queries */
  protected printQuery(query: string, values?: any[] | QueryParams) {
    if (Array.isArray(values)) {
      return printSQLQuery(query, values)
    } else {
      return formatQuery(query, values, this.mysqlPool)
    }
  }

  protected async _doFormattedQuery(query: string, values: QueryParams): Promise<any[]> {
    const formattedSql = values ? formatQuery(query, values, this.mysqlPool) : query
    return await this._doQuery(formattedSql, [])
  }
}

export default MySQLRepository
