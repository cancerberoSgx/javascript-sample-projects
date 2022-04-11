import * as mysql from 'mysql';

export interface DBConfig {
  database: string
  host: string
  password: string
  user: string
  port?: number
}

let connection: mysql.Connection

export async function connect(config: DBConfig): Promise<mysql.Connection> {
  return new Promise((resolve, reject) => {
    connection = mysql.createConnection(config)
    connection.connect(function (err) {
      if (err) {
        reject(err)
      } else {
        resolve(connection)
      }
    })
  })
}

export async function query<T = any>(sql: string, params: any = []): Promise<T[]> {
  if (!connection) {
    throw new Error('connect() first')
  }
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (error, results, fields) => {
      if (error) {
        reject(error)
      } else {
        resolve(results)
      }
    })
  })
}

function formatQuery(sql: string, values: any) {
  return sql
    .replace(/:(\w+)/g, (txt, key) => {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        return connection.escape(values[key]);
      }
      return txt;
    })
    .replace(/\$(\w+)/g, (txt, key) => {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        return connection.escapeId(values[key]);
      }
      return txt;
    });
}

// export const outputSql: string[] = []

export async function formattedQuery(sql: string, values: any) {
  const formattedSql = values ? formatQuery(sql, values) : sql;
  // outputSql && console.log(formattedSql);
  // outputSql.push(formattedSql)
  return await query(formattedSql, []);
}
