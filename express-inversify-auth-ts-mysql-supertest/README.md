Sample web server using express, jwt auth, typescript, inversify, mysql, docker

code architecture structured in Repository, Service and Controller layers.

other techs:
 * mocha, chai
 * apidocs
 * config by environment & env-vars

features implemented:

 * auth (jwt & test mode)
   * auth middleware, login
 * basic users endpoint

# Useful commands

```sh

# start app and execute all tests from scratch (slow)
make test

# start all services
make start-all

# execute all tests without restarting app or running migrations
npm run test-all

# execute single tests
npm run test-pick -- ts-node/register test/update_profile.test.ts

# execute single tests in watch mode
npm run test-watch -- test/grid/batch_distanceBasedOnHomeLocation.test.ts

# clean up database - run migrations again
make test-reset-db

```


# TODO

 * authenticated endpoint.
 * logging
 * implement a simple HTML UI in a separate project
 * MySQLRepository _doTransactQueries