# Repository instructions

Runtime-neutral guidance for AI coding agents in this repo. This file is the always-loaded
**map**; deep per-area detail lives in `.agents/rules/*.md`. Before editing a path, read the
rules whose `paths` glob matches it.

## Personal style — defer to lailai.skill

lailai's **general, cross-project** style — Chinese voice and wording, Markdown, LaTeX math,
OI C++, design principles (统一·简约·现代), who he is and how he decides — lives in the
**lailai.skill** submodule at [`.agents/skills/lailai-skill/`](.agents/skills/lailai-skill/SKILL.md).
Read its `SKILL.md`, then the relevant `references/` / `profile/`, for any task touching voice,
writing, code, or design.

**This repo's `.agents/` holds portable project config.** It does not duplicate the general
rules; where `.agents/rules/*.md` covers only the project-specific slice, it points to the
skill for the rest. Runtime-specific directories are compatibility adapters only.

Init the submodule after cloning: `git submodule update --init`. Update it later with
`git submodule update --remote .agents/skills/lailai-skill`.

## Project

Source for `lailai's Academy` — a Vite + React + TypeScript learning workspace for daily
plans, word review, poetry recitation, and a local AI-planner preview. Node `>=20`; GitHub
Actions builds the app and syncs it to the cloud server for [academy.lailai.one](https://academy.lailai.one/).

## Commands

```bash
npm install
npm run dev
npm run build
npm run check
npm run format
```

The `check` script is the gate before every commit. `npm run build` creates the root-hosted
bundle deployed at `academy.lailai.one`.

## Conventions

<!-- Project-specific rules only. General taste (精益求精, edit-don't-rewrite, comment the *why*, no AI-tells) lives in the skill's profile/ and references/. -->

- **Verify before committing** — the project's check gate must exit clean.
- **Keep the planner local by default** — connect a future API through
  `VITE_API_BASE_URL`; never expose secrets in browser code.
- **Keep UI copy bilingual** — English is the default locale; update the `en` and `zh-Hans`
  message entries together when adding visible text.
- **Small changes go straight to `main`.** Reserve branches / PRs for substantial multi-file work.

## Keep Agent guidance current

Update `AGENTS.md` and applicable `.agents/rules/` in the same change that invalidates them.
Record **durable** conventions, not transient task state; verify against the actual code before
writing, since stale guidance is worse than none. `CLAUDE.md`, `.claude/rules`, and
`.claude/skills` are compatibility pointers, not additional sources of truth.
