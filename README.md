<div align="center">
  <h1>lailai's Academy</h1>
  <p><strong>English</strong> · <a href="README.zh-Hans.md">简体中文</a></p>
  <p>
    <img src="https://img.shields.io/github/actions/workflow/status/lailai0916/academy/deploy.yml?branch=main&style=flat-square" alt="deployment" />
    <img src="https://img.shields.io/github/last-commit/lailai0916/academy?style=flat-square" alt="last commit" />
    <img src="https://img.shields.io/github/languages/top/lailai0916/academy?style=flat-square" alt="top language" />
    <img src="https://img.shields.io/github/repo-size/lailai0916/academy?style=flat-square" alt="repo size" />
    <img src="https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square" alt="code style" />
    <img src="https://img.shields.io/github/license/lailai0916/academy?style=flat-square" alt="license" />
  </p>
</div>

## Project Introduction

Academy is an open-source AI self-study platform I am building to catch up on high school subjects
after informatics competition training.

The target scope is all six subjects in my Zhejiang Gaokao preparation. English vocabulary and
classical Chinese poetry memory training, spaced review and AI explanations are available now. The
six-subject course catalogue is in place, and the first continuous momentum course is being integrated.

[Introduction](docs/project-brief.md) · [Project details](docs/project-overview.md) ·
[PDF](output/pdf/academy-project-brief.pdf) · [Documentation](docs/README.md)

The project and teaching documents are in Simplified Chinese.

## Project Features

🧭 **Six-subject course architecture** — Chinese, mathematics, English, physics, chemistry and
technology share one course catalogue. Course teaching, independent assessment and memory training
keep separate state models before a long-term plan composes their tasks.

📚 **Structured learning** — reviewed content is organised by grade, textbook, volume and
unit instead of being generated as an unverified exercise feed.

🧾 **Reviewed content operations** — administrators preview imports, edit content in a dedicated
workspace and retain immutable revisions, sources and editions before publication. Quality blockers
prevent publication, and import batches can be rolled back without deleting their audit history.

🧠 **Adaptive review** — FSRS handles longer-term scheduling while incorrect items return after
intervening retrievals in the current session. Active recall, delayed tests and varied question types
adjust each learner's daily plan.

🗂️ **Textbook and mistake loop** — learners can study by textbook unit, run diagnostics,
reinforce mistakes, resume an unfinished session, inspect session results and review 7–90 day
learning analysis.

🤖 **Configurable AI** — `gpt-5.6-sol` is the default model. An administrator supplies an
OpenAI-compatible endpoint and encrypted API key for explanations and variations based on reviewed
source content.

👥 **Learning community** — profiles, friends, activity, groups, challenges and restrained
positive feedback support peer learning without public ranking pressure.

🔐 **Invite access** — users register with a username, password and administrator-issued
invite code. First entry confirms grade, score target and daily load; sessions use HttpOnly cookies.
Learners can change their password, inspect signed-in devices and revoke other sessions from
settings.

🖥️ **Public website and study workspace** — public and signed-in course pages distinguish what is
available, being integrated and planned. Learners use a grouped sidebar, top-bar search,
notifications and theme controls.

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
├── docs/                           # Project, teaching, research and engineering documentation
├── output/pdf/                     # Shareable project introduction
├── packages/                       # Internal packages
│   └── shared/                     # Shared Zod models and TypeScript types
├── scripts/                        # Project document generation
├── brand-spec.md                   # Brand rules
├── CONTEXT.md                      # Content and learning domain language
├── package-lock.json               # Locked workspace dependency graph
├── package.json                    # Workspace scripts and dependencies
└── tsconfig.json                   # Shared TypeScript configuration
```

## Project Direction

The next step is to integrate the [momentum lesson draft](docs/learning-pilot.md), connecting its
prerequisite check, explanations, questions, practice, independent assessment and delayed retest.

Further courses will follow my studies, gradually adding plans across Chinese, mathematics,
English, physics, chemistry and technology. See the [development plan](docs/project-roadmap.md).

## Architecture

The npm workspace separates the React client, Fastify API and shared validation models. Existing
FSRS cards remain specific to vocabulary and poetry memory training; continuous courses use their
own lesson-run and evidence model.
Caddy serves the website and proxies `/api` to Fastify; PostgreSQL stores identity,
learning and social data. Shared interface primitives come directly from
[`@lailai0916/ui`](https://github.com/lailai0916/ui) from npm.

Detailed decisions and runbooks are available in
[docs/architecture.md](docs/architecture.md) and [docs/operations.md](docs/operations.md).

## Content Boundary

The repository includes only a small public-domain sample dataset for validating the
learning flow. Textbook content must be licensed and reviewed for edition, volume, unit,
answers and attribution before import. AI explanations do not replace the reviewed source
of truth.

## License

This project's code is licensed under [MIT License](https://github.com/lailai0916/tools/blob/main/LICENSE). Textbook and third-party content require their own permission.
