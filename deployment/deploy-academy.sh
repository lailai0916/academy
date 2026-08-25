#!/usr/bin/env bash
set -Eeuo pipefail

exec 9>/var/lock/academy-deploy.lock
flock -n 9 || { echo "Another Academy deployment is running." >&2; exit 1; }

academy_root=/opt/academy
incoming="$academy_root/incoming"
releases="$academy_root/releases"
environment="$academy_root/.env"
release_id=$(date -u +%Y%m%dT%H%M%SZ)
release="$releases/$release_id"

test -f "$incoming/package-lock.json"
test -f "$incoming/deployment/Dockerfile.api"
test -f "$incoming/deployment/docker-compose.yml"
test -f "$incoming/apps/web/dist/index.html"
test -f "$environment"

mkdir -p "$releases" /var/www/academy.lailai.one
cp -a "$incoming" "$release"

docker build \
  --pull \
  --file "$release/deployment/Dockerfile.api" \
  --tag "academy-api:$release_id" \
  "$release"

previous_release=''
if test -L "$academy_root/current"; then
  previous_release=$(basename "$(readlink -f "$academy_root/current")")
  /usr/local/sbin/backup-academy || true
fi

ln -sfn "$release" "$academy_root/current.next"
mv -Tf "$academy_root/current.next" "$academy_root/current"

compose=(docker compose --project-name academy --env-file "$environment" --file "$release/deployment/docker-compose.yml")
if ! ACADEMY_RELEASE="$release_id" "${compose[@]}" up -d --remove-orphans; then
  if test -n "$previous_release" && test -d "$releases/$previous_release"; then
    ln -sfn "$releases/$previous_release" "$academy_root/current"
    ACADEMY_RELEASE="$previous_release" docker compose \
      --project-name academy \
      --env-file "$environment" \
      --file "$releases/$previous_release/deployment/docker-compose.yml" \
      up -d --remove-orphans
  fi
  exit 1
fi

healthy=false
for _ in $(seq 1 30); do
  if curl --fail --silent --show-error http://127.0.0.1:4100/api/health >/dev/null; then
    healthy=true
    break
  fi
  sleep 2
done

if test "$healthy" != true; then
  "${compose[@]}" logs --tail=120 api >&2 || true
  if test -n "$previous_release" && test -d "$releases/$previous_release"; then
    ln -sfn "$releases/$previous_release" "$academy_root/current"
    ACADEMY_RELEASE="$previous_release" docker compose \
      --project-name academy \
      --env-file "$environment" \
      --file "$releases/$previous_release/deployment/docker-compose.yml" \
      up -d --remove-orphans
  fi
  exit 1
fi

rsync -rlpt --delete "$release/apps/web/dist/" /var/www/academy.lailai.one/
echo "$release_id" > "$academy_root/current-release"
echo "Academy release $release_id is healthy."
