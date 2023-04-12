import { Container } from 'inversify'
import { Pool } from 'mysql'
import { AuthenticationMiddleware, AuthMiddlewareSymbol } from './modules/auth/AuthenticationMiddleware'
import { HealthController } from './modules/healthCheck/HealthController'
import { HealthStorage } from './modules/healthCheck/HealthStorage'
import { getConnectionPool } from './mysql'
import { UsersService } from './modules/users/usersService'
import { UsersStorage } from './modules/users/usersStorage'
import { UsersController } from './modules/users/usersController'

export const bindAppModuleDependencies = (container: Container) => {
  // Shared dependencies
  container.bind<Pool>('DBPool').toConstantValue(getConnectionPool())

  // // Middlewares
  container.bind<AuthenticationMiddleware>(AuthMiddlewareSymbol).to(AuthenticationMiddleware)

  // Modules
  container.bind<HealthStorage>('HealthStorage').to(HealthStorage)
  container.bind<HealthController>('HealthController').to(HealthController)

  container.bind<UsersStorage>('UsersStorage').to(UsersStorage)
  container.bind<UsersService>('UsersService').to(UsersService)
  container.bind<UsersController>('UsersController').to(UsersController)
}
