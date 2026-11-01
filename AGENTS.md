# Repository instructions

Runtime-neutral guidance for coding agents in this repository.

## Personal style

Cross-project writing, design, and engineering preferences live in the shared `lailai-skill`
at `~/.agents/skills/lailai-skill/`, maintained in `lailai0916/lailai-skill`. Read its `SKILL.md`
and only the references relevant to the task. Do not duplicate those general rules here.

## Project

`lailai's Academy` is a Simplified-Chinese, invitation-only AI self-study platform for individual
high-school students. It uses an npm-workspace architecture:

- `apps/web`: React and Vite browser application;
- `apps/api`: Fastify API and Drizzle persistence;
- `packages/shared`: shared schemas and domain types;
- `deployment`: production container, release, proxy, and backup assets.

Node 22+ is required. PostgreSQL is the source of truth. The Web application must never contain
AI keys, database credentials, invitation hashes, or session tokens.

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm test
npm run check
npm run db:generate
```

Run `npm run check` before committing. Run the API integration suite against an isolated database
with `ACADEMY_INTEGRATION_TEST=true` when changing authentication, learning, social, or admin flows.
The performance check verifies built HTML/JS/CSS ceilings in `scripts/performance-budgets.json`;
`node scripts/check-performance.mjs --update` only tightens them.
Use Node 24 to reproduce CI builds and compressed asset sizes.

## Durable conventions

- Keep the student interface Simplified Chinese. Tools remains the bilingual product.
- Use semantic tokens and primitives from `@lailai0916/ui`; keep light, dark, and system modes complete.
- Appearance uses the persistent `ThemeProvider` default and the shared three-option
  `AppearanceControl` in public and authenticated headers. Follow the
  [theme preference contract](https://github.com/lailai0916/ui/blob/main/docs/integration.md#theme-preference-contract).
  The pre-paint script and provider share `lailai.theme`; preserve explicit choices across reloads,
  tabs, and system changes. Do not restore temporary `mode="system"` behavior.
- Measure mastery, delayed accuracy, and long-term retention. Do not optimize product feedback for
  time spent.
- Keep continuous course teaching separate from vocabulary and poetry memory training. FSRS cards
  remain specific to repeatable memory items; compose course, assessment, and memory tasks only at
  the planning boundary.
- Treat reviewed textbook content as the factual source. AI may explain and generate variants but
  must not silently rewrite canonical answers.
- Store invitation and session tokens as hashes. Store AI keys encrypted at rest and return only
  `hasApiKey` to the browser.
- Preserve additive, reviewed database migrations. Back up production before applying migrations.
- Production deployment stops before activation when its database backup fails. Backup jobs share
  a lock and publish uniquely named dumps only after export and archive checks succeed. Failed
  preparation removes only its unactivated release and image tag; preserve activated failures for
  diagnosis. Code rollback never reverses database migrations.
- Never attach usernames, answers, content text, API responses, or other sensitive learning data to
  Umami events.
- Keep `AGENTS.md`, architecture docs, and deployment instructions aligned with code changes.
- Successful deployments retain the five newest releases plus current, previous, and any container
  Compose references. Retention stops when container metadata cannot be verified. Deployment
  regression checks run through `npm run check` and CI. Academy image retention only removes owned
  timestamp tags, keeps the five most recently released distinct image identities and all their
  aliases, and additionally protects current/previous and every container image reference. Metadata
  failures stop cleanup; non-forced Docker removal conflicts preserve the tag.

Shared UI is maintained in `lailai0916/ui` and installed from npm. Import `theme.css` before
`styles.css`, use `--lk-*` tokens, and customize supported `data-lk` hooks rather than generated classes.
