#!/usr/bin/env bash
set -Eeuo pipefail

if test "$(id -u)" -ne 0; then
  echo "Run this installer as root." >&2
  exit 1
fi

deploy_user=${ACADEMY_DEPLOY_USER:-deploy}
repository_root=$(cd "$(dirname "$0")/.." && pwd)

install -d -m 0755 /opt/academy /opt/academy/releases /var/www/academy.lailai.one /var/backups/academy
install -d -m 0755 -o "$deploy_user" -g "$deploy_user" /opt/academy/incoming
install -m 0755 "$repository_root/deployment/deploy-academy.sh" /usr/local/sbin/deploy-academy
install -m 0755 "$repository_root/deployment/backup-academy.sh" /usr/local/sbin/backup-academy
install -m 0644 "$repository_root/deployment/academy-backup.service" /etc/systemd/system/academy-backup.service
install -m 0644 "$repository_root/deployment/academy-backup.timer" /etc/systemd/system/academy-backup.timer

printf '%s ALL=(root) NOPASSWD: /usr/local/sbin/deploy-academy\n' "$deploy_user" > /etc/sudoers.d/academy-deploy
chmod 0440 /etc/sudoers.d/academy-deploy
visudo -cf /etc/sudoers.d/academy-deploy
systemctl daemon-reload
systemctl enable --now academy-backup.timer

echo "Server directories, deploy command, and backup timer are installed."
