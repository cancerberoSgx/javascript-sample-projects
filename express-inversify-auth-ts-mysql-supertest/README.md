Sample web server using express, jwt auth, typescript, inversify, mysql, docker
code architecture structured in Repository, Service and Controller layers.


### Useful commands

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

# load remote DB dump to local DB
mysqldump --hex-blob --column-statistics=0 --host 127.0.0.1 --port 3306 --user projectSeba -pSECRET qa_projectSeba_db > $HOME/Downloads/motto-qa-12-20-2021.sql
docker cp $HOME/Downloads/motto-qa-12-20-2021.sql projectSeba-mysql:/tmp/motto-qa-12-20-2021.sql && 
docker exec -it projectSeba-mysql bash -c 'mysql --default-character-set=utf8mb4 -u root -p1234 projectSeba < /tmp/motto-qa-12-20-2021.sql'
```

