import 'reflect-metadata'
import * as bodyParser from 'body-parser'
import * as cluster from 'cluster'
import * as config from 'config'
import * as helmet from 'helmet'
import { Container } from 'inversify'
import { InversifyExpressServer } from 'inversify-express-utils'
import { cpus } from 'os'
import { bindAppModuleDependencies } from './appModuleDependencies'
import { errorHandler, notFoundHandler } from './errorHandler'

const numCPUs = cpus().length

export const container = new Container()

let server = new InversifyExpressServer(container)

bindAppModuleDependencies(container)

const port = process.env.PORT || 3000

server.setConfig(app => {
  app.use(bodyParser.json())
  app.use(
    helmet({
      referrerPolicy: { policy: 'no-referrer' },
      frameguard: { action: 'deny' },
    })
  )
})

export let app = server.build()

app.use(notFoundHandler)
app.use(errorHandler)

const clusterModeEnabled = JSON.parse(config.get('server.clusterModeEnabled'))
if (clusterModeEnabled && cluster.isMaster) {
  // logger.info(`Application: Master ${process.pid} is running`);

  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork()
  }

  cluster.on('exit', (worker, code, signal) => {
    // logger.error(`Application: worker ${worker.process.pid} died`);
    cluster.fork()
  })
} else {
  app.listen(port, () => {
    console.log(`Application: Server is up on port ${port}`)

    // logger.info(`Application: Server is up on port ${port}`);
  })
  // logger.info(`Application: Worker ${process.pid} started`);
  console.log(`Application: Worker ${process.pid} started`)
}

if (cluster.isMaster) {
  // startSystemMetrics();

  // Throw exception to crash the application
  process.on('uncaughtException', (reason: Error) => {
    // logger.error(`Unhandled Exception: ${reason.stack}.`);
    process.exit(1)
  })

  process.on('unhandledRejection', (reason: Error) => {
    // logger.error(`Unhandled Promise Rejection: ${reason.stack}.`);
    process.exit(1)
  })

  process.on('exit', () => {
    // logger.warn('** Stopping projectDB Backend process **')
  })
}

export default app
