SHELL = /bin/bash

.PHONY: help
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

.PHONY: test
test: start-all ## Run unit tests
	npm install && npm run prettier && npm run type-check
	TEST_CLOUDFLARE_INTEGRATION=$(CLOUDFLARE_EMULATOR_ENABLED) TS_NODE_TRANSPILE_ONLY=true npm test

test-cleandb-users: 
	docker exec -it project-mysql bash -c "mysql --default-character-set=utf8mb4 -u root -p1234 projectDB -e 'delete from users'"

test-reset-db:
	docker exec -it project-mysql bash -c "mysql --default-character-set=utf8mb4 -u root -p1234 -e 'drop database if exists projectDB'"; 
	docker exec -it project-mysql bash -c "mysql --default-character-set=utf8mb4 -u root -p1234 -e 'create database projectDB'";  
	make db-migrate

start-server: start-all
	npm install && NODE_ENV=local npm run dev

.PHONY: run-fresh-local
run-fresh-local:
	NODE_ENV=local npm run dev

.PHONY: run-local
run-local: ## Run a local instance (it requires a manual 'make start-all') 
	NODE_ENV=local npm run dev

.PHONY: docs
docs: ## Generate application documentation
	npm run docs

docs/index.html:
	make docs

njsscan: ## Run static security analysis of the code
	npm run build
	docker run -it -v `pwd`/dist:/src opensecurity/njsscan -h

.PHONY: view-docs
view-docs: docs/index.html
	$(call OPEN_URL, "$(CURDIR)/docs/index.html")

start-zookeeper: stop-zookeeper
	docker run -d --name=zookeeper \
        -e ZOOKEEPER_CLIENT_PORT=32181 \
        -e ZOOKEEPER_TICK_TIME=2000 \
        -e ZOOKEEPER_SYNC_LIMIT=2 \
        confluentinc/cp-zookeeper:6.1.0

stop-zookeeper:
	-docker stop zookeeper
	-docker rm --volumes zookeeper

start-mysql: stop-mysql ## Start MySql docker instance
	docker run \
		-d --name project-mysql \
		-p 3306:3306 \
		-e MYSQL_ROOT_PASSWORD=1234 \
		-e MYSQL_DATABASE=projectDB \
		--health-cmd='mysqladmin ping -h localhost' \
		mysql:5.7 \
		--sql-mode='' 

db-migrate: ## Run database migration
	@bash scripts/wait_for_mysql.sh
	NODE_ENV=local npm run migrate

stop-mysql: ## Stop MySql docker instance
	-docker stop project-mysql
	-docker rm --volumes project-mysql

bash-mysql: ## Log in into MySql docker instance
	docker exec -it project-mysql mysql --default-character-set=utf8mb4 -u root -p1234 projectDB

# Don't add start-graphite here
start-all: start-mysql db-migrate ## Start Kafka, MySql, S3, SNS, SQS, Cognito, Cloudflare and Fluentd docker/emulators instances
	@echo "Done"

# Don't add start-graphite here
stop-all: stop-mysql
	@echo "Done"

