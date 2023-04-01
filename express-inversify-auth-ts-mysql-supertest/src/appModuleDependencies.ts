import { Container } from "inversify";
import { Pool } from "mysql";
import { HealthController } from "./modules/healthCheck/HealthController";
import HealthRepository from "./modules/healthCheck/HealthRepository";
import { getConnectionPool } from "./mysql";

export const bindSharedModuleDependencies = (container: Container) => {
  // Shared dependencies
  container.bind<Pool>('DBPool').toConstantValue(getConnectionPool());

  // // Middlewares
  // container.bind<AuthenticationMiddleware>(AuthMiddlewareSymbol).to(AuthenticationMiddleware);

  // Modules
  container.bind<HealthRepository>('HealthRepository').to(HealthRepository);
  container.bind<HealthController>('HealthController').to(HealthController);
}