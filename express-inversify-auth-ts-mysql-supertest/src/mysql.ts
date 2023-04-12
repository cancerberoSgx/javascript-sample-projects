import * as config from 'config'
import * as mysql from 'mysql'

export const getConnectionPool = () => {
  return mysql.createPool({
    host: config.get('database.host'),
    user: config.get('database.user'),
    password: config.get('database.password'),
    database: config.get('database.name'),
    charset: 'utf8mb4',
    connectionLimit: parseInt(config.get('database.connectionLimit')),
    connectTimeout: 60 * 1000,
    acquireTimeout: 60 * 1000,
    timezone: 'UTC+0', // avoids zone conversion when fetching data
  })
}

/**
 * @param {Pool} mysqlConn
 */
export const closeConnection = (mysqlConn: mysql.Pool) => {
  mysqlConn.end()
}
