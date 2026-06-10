---
name: github-flow
description: GitHub Flow branching strategy with `main` as the default, squash merge only, English prefix + Korean description commit messages. Automatically creates PRs then asks whether to merge.
metadata:
  workflow: github-flow
---

## What is GitHub Flow

A branching strategy where `main` is always deployable, and all changes are made on feature branches then merged via pull requests.

## Rules

- **No direct commits to main** — always work on feature branches
- **Commit per logical change** — separate commits for each concern, not one giant commit
- **Commit only to the current feature branch** — other features go in separate branches
- **Squash merge only** — `gh pr merge --squash --delete-branch`
- No force push, no merge on CI failure

## Branch Naming

Prefix (English) + kebab-case: `feat/`, `fix/`, `refactor/`, `docs/`, `test/`, `chore/`

Examples:
- `feat/version-sync`
- `fix/spa-navigation`
- `refactor/activity-key-unification`
- `docs/architecture-and-matching`
- `fix/selector-fallback-and-typesafe-keys`
- `refactor/split-ui`

## Commit Separation

- **One commit = one logical change** — separation of concerns
- **`lint → test → build` must pass before commit** — use `npm run lint` + `npm test` + `npm run build:firefox`
- **One feature per branch** — don't mix multiple features in a single branch

## Commit Messages

`<prefix>: <description>` — prefix in English, description in Korean.

### Prefixes

| Prefix | Purpose |
|--------|---------|
| `feature` | New feature |
| `fix` | Bug fix |
| `refactor` | Code refactoring (no behavioral change) |
| `docs` | Documentation |
| `test` | Test addition or update |
| `chore` | Build, package, maintenance |

Examples:
- `feature: manifest.json 버전을 대시보드에 자동 반영하도록 개선`
- `fix: SPA 네비게이션 시 대시보드 및 사이드바가 잔존하던 문제 수정`
- `refactor: 활동/과제/출석 매칭 키를 core.buildActivityKey로 통합`
- `docs: 모듈 아키텍처, 매칭 정책, 함수 의도 문서화`
- `chore: web-ext 의존성 버전 업데이트`

### Guidelines

- Descriptions should explain **why** rather than **what** was changed
- Keep it concise and intent-driven
- One commit = one clear intent

## Workflow

1. **Create branch**: `git checkout main && git pull origin main && git checkout -b <type>/<name>`
2. **Develop & commit**: commit per logical unit, ensure `lint → test → build` pass
3. **Create PR**: `git push -u origin <branch> && gh pr create`
4. **Review & iterate**: address feedback, confirm CI passes
5. **Squash merge**: `gh pr merge --squash --delete-branch`
6. **Deploy**: finalize `dist/` artifacts from main after merge

## Hotfixes

`hotfix/<name>` branch → minimal change commit → immediate PR → squash merge → postmortem after deploy

## After PR Creation

- Share the PR URL and summary, then ask whether to squash merge immediately
- Do not merge without user approval
- If checks fail, reviews are pending, or permissions are insufficient, explain the reason and suggest next steps
