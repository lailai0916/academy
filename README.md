<div align="center">
  <img src="apps/web/public/brand/logo.svg" width="72" alt="lailai's Academy" />
  <h1>lailai's Academy</h1>
  <p>面向高中生个人用户的 AI 自学平台</p>
  <p><strong>简体中文</strong> · <a href="README.zh-Hans.md">中文详细说明</a></p>
</div>

## 平台定位

Academy 围绕人教版（部编版）普通高中教材构建个人学习计划。首期聚焦 AI 背单词与
AI 背古诗词，以掌握度、延迟测试正确率和长期记忆作为结果指标，不把使用时长当作核心成绩。

当前平台已经具备：

- 邀请码注册、用户名密码登录、管理员账号与 HttpOnly 会话；
- 按年级和教材内容生成的每日计划；
- 基于 FSRS 的复习调度、主动回忆、延迟测试和自适应题型；
- 由管理员配置的 OpenAI 兼容 AI 讲解与变式练习；
- 个人主页、目标与学习容量设置；
- 好友、学习动态、学习小组、挑战和三类正向反馈；
- 邀请码、AI 服务、用户与 JSON 教材导入管理；
- 浅色、深色及跟随系统的统一界面；
- PostgreSQL、Docker 健康检查、每日备份和可回滚发布；
- Academy 独立 Umami 统计，不发送学习答案或身份字段。

线上地址：[academy.lailai.one](https://academy.lailai.one/)

## 架构

```text
浏览器（React + @lailai/ui）
        │ /api
        ▼
Caddy ─────► Fastify API ─────► PostgreSQL
                     │
                     └────► 管理员配置的 OpenAI 兼容服务
```

仓库采用 npm workspaces：

```text
apps/web/          React 19、Vite、响应式 Web 界面
apps/api/          Fastify、Drizzle ORM、认证、学习与社交 API
packages/shared/   前后端共用的 Zod 模型和 TypeScript 类型
deployment/        Docker Compose、Caddy、发布与备份脚本
```

跨 Tools 与 Academy 的 UI 原语来自 Git 仓库
[`@lailai/ui`](https://github.com/lailai0916/ui)，无需发布到 npm。

## 本地开发

要求 Node.js 22+ 与 PostgreSQL 16+。

```bash
git clone https://github.com/lailai0916/academy.git
cd academy
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

浏览器访问 `http://localhost:5173`，API 默认运行于 `http://127.0.0.1:4100`。

常用命令：

```bash
npm run typecheck     # 严格类型检查
npm run build         # 构建 shared、API 和 Web
npm test              # 常规测试；无测试数据库时跳过集成组
npm run check         # 格式、类型、测试与构建总门禁
npm run db:generate   # 根据 Drizzle schema 生成迁移
```

完整架构与运维说明见 [docs/architecture.md](docs/architecture.md) 和
[docs/operations.md](docs/operations.md)。

## 内容边界

仓库只附带少量公版示例内容，用于验证平台链路，不等同于完整教材数据库。后续教材数据应经过
版权、版本、册次、单元、答案和人工校验后分批导入；AI 只基于已审核内容生成解释和变式，不能
替代教材事实来源。

## 许可协议

项目代码采用 [MIT 许可协议](https://github.com/lailai0916/tools/blob/main/LICENSE)。教材与第三方
内容不因代码许可而自动获得授权。
