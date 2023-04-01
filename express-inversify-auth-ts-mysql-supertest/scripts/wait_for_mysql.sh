#!/bin/bash

echo " $(date -u) |  Waiting for mysql..."

while [[ $(docker inspect project-mysql --format "{{.State.Health.Status}}") != "healthy" ]]
do
  sleep 1
done
echo " $(date -u) |  MySQL is ready."
