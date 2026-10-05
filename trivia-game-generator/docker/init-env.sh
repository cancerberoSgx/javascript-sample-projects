#!/bin/sh
# Creates the repo-root .env from .env.example with freshly generated secrets.
# Run once on a new machine:  ./docker/init-env.sh
set -e
cd "$(dirname "$0")/.."
if [ -f .env ]; then
  echo ".env already exists; not overwriting it." >&2
  exit 1
fi
jwt=$(openssl rand -base64 48 | tr -d '\n=' | tr '+/' '-_')
fernet=$(openssl rand -base64 32 | tr '+/' '-_')   # Fernet = url-safe base64 of 32 bytes
root_pw=$(openssl rand -base64 12 | tr -d '\n=' | tr '+/' '-_')
sed -e "s|^JWT_SECRET=.*|JWT_SECRET=$jwt|" \
    -e "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$fernet|" \
    -e "s|^ROOT_PASSWORD=.*|ROOT_PASSWORD=$root_pw|" \
    .env.example > .env
echo "Created .env. Log in as $(grep '^ROOT_EMAIL=' .env | cut -d= -f2) with password: $root_pw"
