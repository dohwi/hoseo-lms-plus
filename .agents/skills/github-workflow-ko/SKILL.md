---
name: github-workflow-ko
description: GitHub 기반 개발 워크플로를 한국어로 자동 수행하는 스킬. 기본 브랜치를 `main`으로 고정한 github-flow 전략, squash merge 기준의 병합 방식, 그리고 `fix`, `feature` 같은 영어 접두사와 한글 설명을 함께 쓰는 커밋 메시지 규칙을 따르며, 기본적으로 PR 생성까지 진행한 뒤 즉시 병합 여부를 묻는다.
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

예시:
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

`<prefix>: <한글 설명>` — 접두사는 영어, 설명은 한글로 작성한다.

### Prefixes

| Prefix | Purpose | 예시 |
|--------|---------|------|
| `feature` | 새로운 기능 추가 | `feature: manifest.json 버전을 대시보드에 자동 반영하도록 개선` |
| `fix` | 버그 수정 | `fix: SPA 네비게이션 시 대시보드 및 사이드바가 잔존하던 문제 수정` |
| `refactor` | 동작 변화 없는 구조 개선 | `refactor: 활동/과제/출석 매칭 키를 core.buildActivityKey로 통합` |
| `docs` | 문서 수정 | `docs: 모듈 아키텍처, 매칭 정책, 함수 의도 문서화` |
| `test` | 테스트 추가 또는 수정 | `test: buildActivityKey null 반환 및 dedup 필터링 케이스 추가` |
| `chore` | 빌드/패키지/유지보수 | `chore: web-ext 의존성 버전 업데이트` |

### 작성 지침

- 설명은 **무엇을** 바꿨는지보다 **왜** 바꿨는지가 드러나도록 작성
- 불필요하게 긴 문장보다는 짧고 의도가 분명한 표현 사용
- 한 커밋에는 하나의 의도가 드러나도록 구성

## Workflow

1. **브랜치 생성**: `git checkout main && git pull origin main && git checkout -b <type>/<name>`
2. **개발 & 커밋**: 논리 단위로 커밋, `lint → test → build` 통과 확인
3. **PR 생성**: `git push -u origin <branch> && gh pr create`
4. **리뷰 & 반영**: 피드백 처리, CI 통과 확인
5. **Squash Merge**: `gh pr merge --squash --delete-branch`
6. **배포 준비**: merge 후 main에서 최종 `dist/` 산출물 확정

## Hotfixes

`hotfix/<name>` 브랜치 생성 → 최소 변경 커밋 → 즉시 PR → squash merge → 배포 후 사후 검토

## PR 생성 후 기본 동작

- PR 생성 후에는 결과를 공유한 다음 즉시 squash merge 진행 여부를 묻는다.
- 병합 여부를 묻기 전에는 자동 병합하지 않는다.
- 사용자가 병합을 승인하면 squash merge로 즉시 진행한다.
- 체크 실패, 리뷰 미완료, 권한 부족처럼 병합 조건이 맞지 않으면 사유를 설명하고 다음 액션만 제안한다.
