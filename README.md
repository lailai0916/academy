<div align="center">
  <h1>lailai's Academy</h1>
  <p><strong>English</strong> · <a href="README.zh-Hans.md">简体中文</a></p>
  <p>
    <img src="https://img.shields.io/github/actions/workflow/status/lailai0916/academy/deploy.yml?style=flat-square" alt="deployment" />
    <img src="https://img.shields.io/github/last-commit/lailai0916/academy?style=flat-square" alt="last commit" />
    <img src="https://img.shields.io/github/languages/top/lailai0916/academy?style=flat-square" alt="top language" />
    <img src="https://img.shields.io/github/repo-size/lailai0916/academy?style=flat-square" alt="repo size" />
    <img src="https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square" alt="code style" />
    <img src="https://img.shields.io/github/license/lailai0916/academy?style=flat-square" alt="license" />
  </p>
</div>

## Project Introduction

An invite-only adaptive learning platform for individual Chinese high school students at
[academy.lailai.one](https://academy.lailai.one). The first learning systems cover English
vocabulary and classical Chinese poetry, with progress measured through mastery, delayed
test accuracy and long-term retention.

## Project Features

📚 **Structured learning** — reviewed content is organised by grade, textbook, volume and
unit instead of being generated as an unverified exercise feed.

🧠 **Adaptive review** — FSRS scheduling, active recall, delayed tests and varied question
types adjust each learner's daily plan.

🗂️ **Textbook and mistake loop** — learners can study by textbook unit, run diagnostics,
reinforce mistakes, inspect session results and review 7–90 day learning analysis.

🤖 **Configurable AI** — `gpt-5.6-sol` is the default model. An administrator supplies an
OpenAI-compatible endpoint and encrypted API key for explanations and variations based on reviewed
source content.

👥 **Learning community** — profiles, friends, activity, groups, challenges and restrained
positive feedback support peer learning without public ranking pressure.

🔐 **Invite access** — users register with a username, password and administrator-issued
invite code; sessions use HttpOnly cookies.

🖥️ **Public website and study workspace** — visitors receive a clear product overview,
while signed-in learners use a grouped sidebar, top-bar search, notifications and theme controls.

## Getting Started

Node.js 22+ and PostgreSQL 16+ are required.

```bash
git clone https://github.com/lailai0916/academy.git
cd academy
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

The website runs at `http://localhost:5173`; the API defaults to
`http://127.0.0.1:4100`. Run the complete local gate before submitting changes:

```bash
npm run check
```

## Project Structure

```bash
academy/
├── apps/                           # Deployable applications
│   ├── api/                        # Fastify API and Drizzle schema
│   └── web/                        # React and Vite web interface
├── deployment/                     # Caddy, Docker and operations scripts
├── design-system/                  # Academy interface specification
├── docs/                           # Architecture and operations documentation
├── packages/                       # Internal packages
│   └── shared/                     # Shared Zod models and TypeScript types
├── brand-spec.md                   # Brand rules
├── package-lock.json               # Locked workspace dependency graph
├── package.json                    # Workspace scripts and dependencies
└── tsconfig.json                   # Shared TypeScript configuration
```

## Architecture

The npm workspace separates the React client, Fastify API and shared validation models.
Caddy serves the website and proxies `/api` to Fastify; PostgreSQL stores identity,
learning and social data. Shared interface primitives come directly from
[`@lailai/ui`](https://github.com/lailai0916/ui) through GitHub rather than npm.

Detailed decisions and runbooks are available in
[docs/architecture.md](docs/architecture.md) and [docs/operations.md](docs/operations.md).

## Content Boundary

The repository includes only a small public-domain sample dataset for validating the
learning flow. Textbook content must be licensed and reviewed for edition, volume, unit,
answers and attribution before import. AI explanations do not replace the reviewed source
of truth.

## License

This project's code is licensed under [MIT License](https://github.com/lailai0916/tools/blob/main/LICENSE). Textbook and third-party content require their own permission.
