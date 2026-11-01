#!/usr/bin/env bash
set -Eeuo pipefail

umask 077
exec 8>/var/lock/academy-backup.lock
flock 8

academy_root=/opt/academy
backup_root=/var/backups/academy
environment="$academy_root/.env"
current="$academy_root/current"

test -L "$current"
test -f "$environment"
mkdir -p "$backup_root"

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
temporary=$(mktemp "$backup_root/academy-$timestamp.XXXXXX.dump.partial")
destination=${temporary%.partial}
trap 'rm -f -- "$temporary"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

docker compose \
  --project-name academy \
  --env-file "$environment" \
  --file "$current/deployment/docker-compose.yml" \
  exec -T db sh -c 'pg_dump --format=custom --no-owner --username="$POSTGRES_USER" "$POSTGRES_DB"' \
  > "$temporary"

test -s "$temporary"
docker compose \
  --project-name academy \
  --env-file "$environment" \
  --file "$current/deployment/docker-compose.yml" \
  exec -T db pg_restore --list < "$temporary" > /dev/null
mv "$temporary" "$destination"
find "$backup_root" -type f -name 'academy-*.dump' -mtime +14 -delete
echo "Created $destination"
