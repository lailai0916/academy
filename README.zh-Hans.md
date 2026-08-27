<div align="center">
  <h1>lailai's Academy</h1>
  <p><a href="README.md">English</a> · <strong>简体中文</strong></p>
  <p>
    <img src="https://img.shields.io/github/actions/workflow/status/lailai0916/academy/deploy.yml?style=flat-square" alt="部署状态" />
    <img src="https://img.shields.io/github/last-commit/lailai0916/academy?style=flat-square" alt="最后提交" />
    <img src="https://img.shields.io/github/languages/top/lailai0916/academy?style=flat-square" alt="主要语言" />
    <img src="https://img.shields.io/github/repo-size/lailai0916/academy?style=flat-square" alt="仓库大小" />
    <img src="https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square" alt="代码风格" />
    <img src="https://img.shields.io/github/license/lailai0916/academy?style=flat-square" alt="许可证" />
  </p>
</div>

## 项目简介

[academy.lailai.one](https://academy.lailai.one) 是面向中国高中生个人用户的邀请码制自适应
学习平台。首期学习系统覆盖英语单词和古诗词，以掌握度、延迟测试正确率与长期记忆衡量进步。

## 项目特性

📚 **结构化学习** —— 经过审核的内容按年级、教材、册次与单元组织。未经验证的生成题目
不会成为学习主线。

🧾 **教材内容工作流** —— 管理员可预检批次、在专用工作台编辑内容，并在发布前保留不可变
修订记录、来源和版次。完整性问题会阻止发布；导入批次可回滚，但不会删除审计记录。

🧠 **自适应复习** —— FSRS 负责复习调度。主动回忆、延迟测试与多种题型共同调整每日计划。

🗂️ **教材与错题闭环** —— 学生可按教材单元学习、执行水平诊断、集中巩固错题、继续未完成
任务，并查看每组学习结果与近 7–90 天分析。

🤖 **可配置 AI** —— 默认模型为 `gpt-5.6-sol`。管理员配置 OpenAI 兼容服务与加密
API Key，AI 基于已审核内容生成错因讲解与变式。

👥 **学习社区** —— 个人主页、好友、动态、小组与挑战支持同伴学习。平台不制造公开排名压力。

🔐 **邀请码访问** —— 用户凭用户名、密码与管理员生成的邀请码注册。会话通过 HttpOnly Cookie
保存；设置页支持修改密码、查看登录设备和撤销其他会话。

🖥️ **公开官网与学习空间** —— 访客先了解平台，登录后进入带分区侧栏、顶部搜索、通知和主题
控制的学习工作区。两个界面都支持浅色、深色与跟随系统主题。

## 快速开始

项目要求 Node.js 22+ 与 PostgreSQL 16+。

```bash
git clone https://github.com/lailai0916/academy.git
cd academy
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

网站运行于 `http://localhost:5173`，API 默认运行于 `http://127.0.0.1:4100`。提交改动前运行
完整的本地门禁：

```bash
npm run check
```

## 项目结构

```bash
academy/
├── apps/                           # 可部署应用
│   ├── api/                        # Fastify API 与 Drizzle schema
│   └── web/                        # React 与 Vite 网页界面
├── deployment/                     # Caddy、Docker 与运维脚本
├── design-system/                  # Academy 界面规范
├── docs/                           # 架构与运维文档
├── packages/                       # 内部软件包
│   └── shared/                     # 共用 Zod 模型与 TypeScript 类型
├── brand-spec.md                   # 品牌规范
├── CONTEXT.md                      # 内容与学习领域语言
├── package-lock.json               # 锁定的 workspace 依赖关系
├── package.json                    # Workspace 脚本与依赖
└── tsconfig.json                   # 共用 TypeScript 配置
```

## 技术架构

npm workspace 将 React 客户端、Fastify API 与共用验证模型分离。Caddy 提供网页并把
`/api` 代理至 Fastify，PostgreSQL 保存身份、学习与社交数据。共享界面原语通过 GitHub
直接使用 [`@lailai/ui`](https://github.com/lailai0916/ui)，无需发布到 npm。

详细决策与运维手册见 [docs/architecture.md](docs/architecture.md) 和
[docs/operations.md](docs/operations.md)。

## 内容边界

仓库只附带少量公版示例数据，用于验证完整学习链路。教材内容导入前必须确认授权，并人工审核
版本、册次、单元、答案与出处。AI 讲解不能替代经过审核的内容真源。

## 许可协议

本项目代码采用 [MIT 许可协议](https://github.com/lailai0916/tools/blob/main/LICENSE)。教材与第三方内容需要另行取得授权。
