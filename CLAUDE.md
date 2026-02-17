# CLAUDE.md

Project context for Claude Code.

## Project

WattsWay — an intelligent trip planner for Tesla owners (Next.js + TypeScript + Tailwind CSS).

## Dev Commands

- `npm install` — install dependencies
- `npm run dev` — start dev server on localhost:3000
- `npm run build` — production build
- `npm run lint` — run ESLint

## Versioning

The app version flows through: `package.json` → `next.config.ts` (reads `packageJson.version`) → `NEXT_PUBLIC_APP_VERSION` env var → displayed in navigation/footer.

### Auto Version Bump (`.github/workflows/auto-version.yml`)

Runs automatically when a PR is merged to `main`:

- **Default:** bumps the **patch** version (e.g. 1.2.0 → 1.2.1)
- **PR labels override:** add `version:minor` or `version:major` to the PR before merging to bump minor or major instead
- **Loop guard:** the workflow commits with the prefix `chore(version):` and skips if the latest commit on `main` already has that prefix
- **What it does:** runs `npm version --no-git-tag-version`, commits `package.json`/`package-lock.json`, creates and pushes a git tag `v<version>`

### Manual Release (`.github/workflows/release.yml`)

Triggered via `workflow_dispatch` in GitHub Actions. Pick patch/minor/major, and it bumps the version, pushes, and creates a GitHub release with auto-generated notes.

## Branch Naming

Use prefixes: `feat/`, `fix/`, `docs/`, `refactor/`.
