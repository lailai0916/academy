<div align="center">
  <h1>lailai's Academy</h1>
  <p><a href="README.md">English</a> · <strong>简体中文</strong></p>
  <p>
    <img
      src="https://img.shields.io/github/actions/workflow/status/lailai0916/academy/deploy.yml?style=flat-square"
    />
    <img
      src="https://img.shields.io/github/last-commit/lailai0916/academy?style=flat-square"
    />
    <img
      src="https://img.shields.io/github/languages/top/lailai0916/academy?style=flat-square"
    />
    <img
      src="https://img.shields.io/github/repo-size/lailai0916/academy?style=flat-square"
    />
    <img
      src="https://img.shields.io/badge/code_style-prettier-ff69b4?style=flat-square"
    />
    <img
      src="https://img.shields.io/github/license/lailai0916/academy?style=flat-square"
    />
  </p>
</div>

## 项目简介

`lailai's Academy` 是一个个人学习工作台，通过每日看板、本地规划器、主动回忆单词卡、
古诗背诵和复习队列，把长期目标拆成每天可执行的练习。

## 项目特性

🧭 **每日看板** —— 把下一组学习任务保持在视线内，并支持直接编辑。

🧠 **本地规划器** —— 将学习目标转换成一次具体的专注学习，并可以直接加入今日安排。

📖 **单词记忆** —— 翻开单词、按真实难度自评，并用轻量的间隔复习安排下一次提示。

🪶 **古诗背诵** —— 阅读古诗、查看白话理解和记忆提示，记录主动背诵次数。

🔁 **复习队列** —— 查看现在可以复习的单词和古诗，直接进入对应学习环节。

💾 **本地持久化** —— 通过浏览器的 `localStorage` 保存任务、单词、古诗进度与语言偏好。

🌐 **双语界面** —— 默认使用英语，也可以在页面内切换到简体中文。

🚀 **云服务器部署** —— 使用 Vite 构建，由 GitHub Actions 同步到 Academy 云服务器。

## 快速开始

克隆仓库，初始化 skill 子模块并安装依赖：

```bash
git clone https://github.com/lailai0916/academy.git
cd academy
git submodule update --init
npm install
npm run dev
```

在本地构建并预览生产版本：

```bash
npm run build
npm run preview
```

线上地址为 [academy.lailai.one](https://academy.lailai.one/)。

## 项目结构

```bash
academy/
├── .github/                        # GitHub 协作与部署工作流
│   └── workflows/                  # GitHub Actions 部署工作流
│       └── deploy.yml              # 构建并同步 Vite 应用到云服务器
├── public/                         # 复制到部署根目录的静态资源
│   └── brand/                      # Academy 品牌资源
│       ├── favicon.ico             # 浏览器图标
│       └── logo.svg                # Academy 标志
├── src/                            # React 应用源码
│   ├── App.tsx                     # 看板、规划器与学习模块
│   ├── main.tsx                    # React 入口
│   └── styles.css                  # 共享响应式主题样式
├── brand-spec.md                   # 视觉 token 与资源清单
├── index.html                      # Vite HTML 入口
├── package.json                    # 脚本与依赖
└── vite.config.ts                  # 基础路径与 React 插件配置
```

规划器目前是本地、确定性的实现。未来可以通过 `VITE_API_BASE_URL` 接入 API；密钥必须留在
服务端边界内。

## 许可协议

本项目代码采用 [MIT 许可协议](https://github.com/lailai0916/tools/blob/main/LICENSE)。
