#!/bin/sh
# Runs once, when the db volume is first created: adds a separate database for backend tests.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "CREATE DATABASE \"${POSTGRES_DB}_test\""
