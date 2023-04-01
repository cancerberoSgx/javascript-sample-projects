import { Pool } from 'mysql';

export function formatQuery(sql: string, values: { [key: string]: any }, pool: Pool) {
  return sql
    .replace(/:(\w+)/g, (txt, key) => {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        return pool.escape(values[key]);
      }
      return txt;
    })
    .replace(/\$(\w+)/g, (txt, key) => {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        return pool.escapeId(values[key]);
      }
      return txt;
    });
}
