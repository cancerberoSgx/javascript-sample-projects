import * as mysql from 'mysql'
import { config } from './config'

const pool = mysql.createPool({
  host: config.dbHost,
  user: config.dbUser,
  password: config.dbPassword,
  database: config.dbName,
  port: config.port,
  connectionLimit: Number(process.env.DB_POOL_CONNECTION_LIMIT) || 10,
})

export function query(sql: String, values = null) {
  if (Array.isArray(values)) {
    return queryRaw(sql, values)
  } else {
    return objectQuery(sql, values)
  }
}

export function queryRaw(sql, values = []) {
  return new Promise((resolve, reject) =>
    pool.query(sql, values, (err, results, fields) => {
      if (err) {
        return reject(err)
      }
      resolve(results)
    })
  )
}

export function objectQuery(sql, values = null) {
  const formattedSql = values ? formatQuery(sql, values) : sql
  return queryRaw(formattedSql)
}

function formatQuery(sql, values) {
  return sql
    .replace(/:(\w+)/g, (txt, key) => {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        return this.pool.escape(values[key]);
      }
      return txt;
    })
    .replace(/\$(\w+)/g, (txt, key) => {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        return this.pool.escapeId(values[key]);
      }
      return txt;
    });
}

