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

GitHub Actions 先构建、检查页面 HTML/JS/CSS 性能预算，并在隔离 PostgreSQL 上执行迁移与完整 API 集成测试，然后上传 release。
服务器脚本为每次发布创建时间戳目录和独立 API image；健康检查通过后才更新静态文件。API
健康检查失败时会恢复前一 release 的软链接和容器 image。
已有生产版本时，发布脚本必须先成功备份数据库，才会切换版本或启动新容器。构建或备份失败会
移除本次尚未启用的 release 和镜像标签；一旦开始启用容器，失败版本会保留供排查。
同步完成后，GitHub Actions 还会核对公开首页、入口和所有按需页面资源及 Logo 是否和本次构建完全一致，并检查公开
`/api/health`。这些检查只读取部署结果，不写入学习数据。

成功发布后保留最新五个 release，以及 `current`、`previous` 和容器 Compose 引用的目录。
镜像仅清理 `academy-api:<时间戳>` 自有标签，保留最近发布的五个不同镜像及其全部别名，
额外保护当前版、回退版和所有容器引用。元数据无法核实时停止清理；普通删除发生引用冲突时保留，不强制删除。

数据库迁移必须保持向后兼容。代码回滚不会自动反向迁移数据库；若迁移已改变数据，恢复旧数据
必须另行停止写入并从已验证的备份恢复，不能只切换旧镜像。

## 备份

`academy-backup.timer` 每天 03:20（Asia/Shanghai）执行 PostgreSQL custom-format 备份，
保存在 `/var/backups/academy`，权限仅 root 可读，默认保留 14 天。已有生产版本时，每次发布
前必须成功创建一份备份。定时与发布备份使用同一把锁串行执行，唯一文件名避免同秒覆盖；
导出成功、非空且通过 `pg_restore --list` 检查后才发布为 `.dump`，失败或收到 INT、TERM 时会
移除本次 `.partial`；强制终止或主机断电仍可能留下未完成文件。这项检查不能代替实际恢复演练。

常用检查：

```bash
systemctl status academy-backup.timer
sudo /usr/local/sbin/backup-academy
docker compose -p academy --env-file /opt/academy/.env \
  -f /opt/academy/current/deployment/docker-compose.yml ps
curl --fail https://academy.lailai.one/api/health
```

应定期把备份复制到异地存储，并实际演练恢复；只有生成 dump 但未验证恢复，不算完整备份。

部署脚本回归通过 `python3 -B -m unittest discover -s deployment` 执行，并包含在 `npm run check`
和 CI 中。备份与部署隔离测试需要 Linux 和 `flock`，其他平台会跳过这部分测试。
