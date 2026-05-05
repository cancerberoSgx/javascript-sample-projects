import { Connection } from '../repository/connectionRepository';
import { PostgresConnector } from './PostgresConnector';
import { IConnector } from './types';

export { IConnector, TableInfo, FieldInfo } from './types';

export function getConnector(conn: Connection): IConnector {
  switch (conn.type) {
    case 'postgres':
      return new PostgresConnector(conn);
    default:
      throw new Error(`Unsupported connection type: "${conn.type}"`);
  }
}
