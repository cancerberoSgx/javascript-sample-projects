import { controller, httpGet } from 'inversify-express-utils';
// import { contextLogger, flowLogger } from '../../../factory/logger';
import { inject } from 'inversify';
// import { Logger } from 'winston';
import HealthRepository from './HealthRepository';

@controller('/health')
export class HealthController {
  // readonly logger: Logger = contextLogger(flowLogger);

  constructor(@inject('HealthRepository') private healthRepository: HealthRepository) {}

  /**
   * @apiVersion 1.0.0
   * @api {get} /health Health check
   * @apiDescription Get the status of the system
   * @apiName Health
   * @apiGroup System
   * @apiHeader Content-type application/json
   *
   * @apiSuccess {string} db  Current status of the database connection
   *
   * @apiSuccessExample {json} Success-Response:
   * {"db": "healthy"}
   **/
  @httpGet('/')
  public async get(req, res, next): Promise<void> {
    let db = false;

    try {
      // this.logger.info('Get health status');
      await this.healthRepository.health();
      db = true;
    } catch (e) {
      // this.logger.error('Error getting health status: ', e);
      console.log('Error getting health status: ', e);
      
      db = false;
    }

    let healthy: Boolean = db;
    healthy ? res.status(200) : res.status(500);

    res.json({ healthy, db });
  }
}
