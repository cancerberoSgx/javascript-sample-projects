import { inject, injectable } from 'inversify';
// import { contextLogger, dbLogger } from '../../../factory/logger';
// import { Logger } from 'winston';
import { Pool } from 'mysql';
import { MySQLRepository } from '../../MySQLRepository';

// const logger: Logger = contextLogger(dbLogger);

@injectable()
export class HealthRepository extends MySQLRepository {
  constructor(@inject('DBPool') mysqlPool: Pool) {
    super(mysqlPool);
  }

  public async health(): Promise<boolean> {
    // logger.debug('Health');
    await this._doQuery('SELECT TRUE', []);
    return true;
  }
}

export default HealthRepository;
