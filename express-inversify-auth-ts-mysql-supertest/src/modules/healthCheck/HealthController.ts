import { controller, httpGet } from 'inversify-express-utils'
import { inject } from 'inversify'
import { HealthStorage } from './HealthStorage'

@controller('/health')
export class HealthController {
  constructor(@inject('HealthStorage') private healthStorage: HealthStorage) {}

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
    let db = false

    try {
      await this.healthStorage.health()
      db = true
    } catch (e) {
      console.log('Error getting health status: ', e)
      db = false
    }

    let healthy: Boolean = db
    healthy ? res.status(200) : res.status(500)

    res.json({ healthy, db })
  }
}
