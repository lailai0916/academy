# Academy 部署与运维

## 生产结构

服务器使用 Caddy 托管 `apps/web/dist`，将 `/api/*` 转发至宿主机
`127.0.0.1:4100`。Fastify 与 PostgreSQL 运行在名为 `academy` 的 Docker Compose
项目中，数据库使用独立 volume。

## 首次安装

1. 将代码同步到服务器临时目录，以 root 运行 `deployment/install-server.sh`。
2. 在 `/opt/academy/.env` 写入 600 权限的生产变量。PostgreSQL 密码建议使用 URL 安全的
   随机十六进制；`AI_CONFIG_ENCRYPTION_KEY` 至少 32 个随机字符。
3. 将 `deployment/Caddyfile.academy` 合并到生产 Caddy 配置并执行 `caddy validate`。
4. 以部署用户同步完整 release 到 `/opt/academy/incoming`，再运行
   `sudo /usr/local/sbin/deploy-academy`。
5. 首次登录成功后，从 `/opt/academy/.env` 清空 `BOOTSTRAP_ADMIN_PASSWORD`，再执行一次发布。

## 发布与回滚

GitHub Actions 先构建并在隔离 PostgreSQL 上执行迁移与 5 组 API 集成测试，然后上传 release。
服务器脚本为每次发布创建时间戳目录和独立 API image；健康检查通过后才更新静态文件。API
健康检查失败时会恢复前一 release 的软链接和容器 image。

数据库迁移必须保持向后兼容。代码回滚不会自动反向迁移数据库。

## 备份

`academy-backup.timer` 每天 03:20（Asia/Shanghai）执行 PostgreSQL custom-format 备份，
保存在 `/var/backups/academy`，权限仅 root 可读，默认保留 14 天。每次发布前也会尽力创建一份
备份。

常用检查：

```bash
systemctl status academy-backup.timer
sudo /usr/local/sbin/backup-academy
docker compose -p academy --env-file /opt/academy/.env \
  -f /opt/academy/current/deployment/docker-compose.yml ps
curl --fail https://academy.lailai.one/api/health
```

应定期把备份复制到异地存储，并实际演练恢复；只有生成 dump 但未验证恢复，不算完整备份。
