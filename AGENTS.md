# Repository instructions

Runtime-neutral guidance for coding agents in this repository.

## Personal style

Cross-project writing, design, and engineering preferences live in the `lailai-skill` submodule
at `.agents/skills/lailai-skill/`. Read its `SKILL.md` and only the references relevant to the
task. Do not duplicate those general rules here.

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

## Durable conventions

- Keep the student interface Simplified Chinese. Tools remains the bilingual product.
- Use semantic tokens and primitives from `@lailai/ui`; keep light, dark, and system modes complete.
- Measure mastery, delayed accuracy, and long-term retention. Do not optimize product feedback for
  time spent.
- Treat reviewed textbook content as the factual source. AI may explain and generate variants but
  must not silently rewrite canonical answers.
- Store invitation and session tokens as hashes. Store AI keys encrypted at rest and return only
  `hasApiKey` to the browser.
- Preserve additive, reviewed database migrations. Back up production before applying migrations.
- Never attach usernames, answers, content text, API responses, or other sensitive learning data to
  Umami events.
- Keep `AGENTS.md`, architecture docs, and deployment instructions aligned with code changes.
