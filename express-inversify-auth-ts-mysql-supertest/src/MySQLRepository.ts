import { injectable } from 'inversify';
import { Pool, PoolConnection } from 'mysql';
import 'reflect-metadata';
import { formatQuery } from './helpers/FormattedQuery';
import { printSQLQuery } from './helpers/Util';

type QueryParams = { [key: string]: any };
@injectable()
export abstract class MySQLRepository {
  public constructor(protected mysqlPool: Pool) { }

  protected async _getConnection(): Promise<PoolConnection> {
    return new Promise<PoolConnection>((resolve, reject) => {
      this.mysqlPool.getConnection((err, connection) => {
        if (err) return reject(err);
        resolve(connection);
      });
    });
  }

  async _queryHelper(
    connection: PoolConnection,
    // logger: Logger,
    query: string,
    params: any[]
  ): Promise<any[]> {
    // logger.debug('Do query:', query, params);
    return new Promise<any[]>((resolve, reject) => {
      // const startTimeNs: bigint = process.hrtime.bigint();

      connection.query(query, params, (error, results, fields) => {
        if (error) {
          // logger.error('Cannot execute query, error=', error);
          return reject(error);
        }

        // const stopTimeNs: bigint = process.hrtime.bigint();
        // logger.debug(`Result(s), ${nanoToMilli(stopTimeNs - startTimeNs)} ms:`, results);

        resolve(results);
      });
    });
  }
  
  protected async _doQuery(query: string, params?: any[] | QueryParams): Promise<any[]> {
    const connection: PoolConnection = await this._getConnection();
    try {
      if (Array.isArray(params)) {
        return await this._queryHelper(connection, /*queryLogger(),*/ query, params || []);
      } else {
        return await this._doFormattedQuery(query, params || {});
      }
    } finally {
      connection.release();
    }
  }

  /** useful to debug executed queries */
  protected printQuery(query: string, values?: any[] | QueryParams) {
    if (Array.isArray(values)) {
      return printSQLQuery(query, values);
    } else {
      return formatQuery(query, values, this.mysqlPool);
    }
  }

  protected async _doFormattedQuery(query: string, values: QueryParams): Promise<any[]> {
    const formattedSql = values ? formatQuery(query, values, this.mysqlPool) : query;
    return await this._doQuery(formattedSql, []);
  }

  // /**
  //  * @deprecated Use _doTransactQueries instead
  //  *
  //  * TODO Remove usage of this function
  //  */
  // protected async _doQueriesWithTransaction(queryProvider: QueryProvider) {
  //   const logger: Logger = queryLogger();

  //   logger.debug('Do queries with transaction:', queryProvider);

  //   const connection: PoolConnection = await this._getConnection();
  //   const results: any[] = [];

  //   try {
  //     return new Promise<any[]>((resolve, reject) => {
  //       connection.beginTransaction(async (err: MysqlError) => {
  //         if (err) {
  //           connection.rollback();
  //           reject(err);
  //         } else {
  //           try {
  //             // Get queries
  //             let queries: QueryDef[] = [];
  //             queryProvider(queries);

  //             // Execute all queries and commit
  //             for (const query of queries) {
  //               results.push(
  //                 await this._queryHelper(connection, logger, query[0], query[1] ? query[1] : [])
  //               );
  //             }

  //             connection.commit((err: MysqlError) => {
  //               if (err) reject(err);
  //               else resolve(results);
  //             });
  //           } catch (e) {
  //             connection.rollback();
  //             reject(e);
  //           }
  //         }
  //       });
  //     });
  //   } finally {
  //     connection.release();
  //   }
  // }

  // /**
  //  * Executes a set of queries inside a transaction. If any statement fails in the
  //  * execution callback the transaction is canceled automatically. e.g.
  //  *
  //  *  try {
  //  *    const result: MyType =
  //  *       this._doTransactQueries(async (doQuery: QueryExecutor): Promise<MyType> =>
  //  *     {
  //  *       let res = await doQuery('INSERT INTO foo1 VALUES(... ');
  //  *       res = await doQuery('INSERT INTO foo2 VALUES(...');
  //  *       ...
  //  *       res = await doQuery('...');
  //  *
  //  *       return <something of type MyType>;
  //  *     });
  //  *  }
  //  *  catch(e) {
  //  *     // Here the transaction is already canceled
  //  *     ...
  //  *  }
  //  *
  //  * @param executor
  //  */
  // // prettier-ignore
  // protected async _doTransactQueries<T>(executor: QueryExecutorCallback<T>): Promise<T> {
  //   // const logger: Logger = queryLogger();

  //   // logger.debug('Do transaction queries');

  //   const connection: PoolConnection = await this._getConnection();
  //   let result: T = null;

  //   try {
  //     return new Promise<T>((resolve, reject) => {
  //       // logger.debug("Transaction begin");
  //       connection.beginTransaction(async (err: MysqlError) => {
  //         if (err) {
  //           connection.rollback();
  //           reject(err);
  //         } else {
  //           try {
  //             // Give the caller the opportunity to execute his/her queries
  //             result = await executor(this._queryHelper.bind(this, connection, logger));

  //             connection.commit((err: MysqlError) => {
  //               if (err) {
  //                 reject(err);
  //               } else {
  //                 resolve(result);
  //                 logger.debug('Transaction committed');
  //               }
  //             });
  //           } catch (e) {
  //             connection.rollback();
  //             logger.error('Transaction rollbacked');
  //             reject(e);
  //           }
  //         }
  //       });
  //     });
  //   } finally {
  //     connection.release();
  //   }
  // }

}

export default MySQLRepository;
