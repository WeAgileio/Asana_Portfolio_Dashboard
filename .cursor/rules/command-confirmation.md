---
description: Enforce Conventional Commits for commit messages and change summaries
globs:
  - "**/*"
alwaysApply: true
---

You are helping generate git commit messages, PR titles, and change summaries for this repository.

Follow the Conventional Commits 1.0.0 style strictly.

## Git 提交流程規則

在這個專案中，**任何需要你協助執行 git 提交（本地或遠端）時，操作順序必須嚴格遵守：**

1. `git pull`：先從遠端拉取最新變更，處理衝突後再繼續。
2. `git commit`：使用符合本檔案規則的 Conventional Commit 訊息建立提交。
3. `git push`：最後才把本地提交推送到遠端。

若使用者已經手動完成其中部分步驟（例如先自己 pull），你可以跳過已完成的步驟，但 **絕對不得在未 pull 的情況下直接進行 commit → push**。

在實際執行任何 git 指令前，必須先用自然語言向使用者說明你打算執行的步驟與指令，並等待使用者確認後再執行。

## Release 規則

當你要協助建立新版本（例如：打 tag、建立 GitHub Release、或在討論中明確提到「release / 發版 / 上線」）時，必須同時確保：

- `README.md` 中有對應這次版本的 **Release Notes** 區塊或條目，內容至少包含：
  - 本次版本的簡短說明（例如：新增了哪些主要功能或修正了哪些問題）
  - 若有破壞性修改，需在這裡特別標註
- 若 `README.md` 尚未有 Release 區塊，先幫使用者在 README 底部加上一個簡單的「Release Notes」章節，然後再加入這次版本的說明。
- 在幫忙產生 release 描述或 changelog 時，優先復用或同步到 `README.md` 的 Release Notes，避免兩邊內容不一致。

## Commit message format

Use this format:

<type>[optional scope]: <description>

[optional body]

[optional footer(s)]

## Allowed types

Prefer these types:

- feat: a new feature
- fix: a bug fix
- docs: documentation only changes
- style: formatting, missing semi colons, white-space, etc. (no code meaning change)
- refactor: code change that neither fixes a bug nor adds a feature
- perf: code change that improves performance
- test: adding or correcting tests
- build: build system or external dependency changes
- ci: CI/CD pipeline changes
- chore: maintenance work or misc non-product changes

## Scope rules

- Scope is optional.
- When helpful, use a short noun describing the area changed.
- Examples:
  - feat(auth): add SSO login
  - fix(api): handle empty payload
  - docs(readme): update setup steps

## Description rules

- Use lower case English unless the user explicitly wants another language.
- Keep the description concise and specific.
- Do not end the description with a period.
- Prefer imperative style:
  - "add user avatar upload"
  - "fix retry logic for webhook timeout"

## Breaking changes

If the change is breaking, use one of these:

- feat(api)!: remove v1 session endpoint
- refactor(core)!: change plugin lifecycle hooks

And when needed, add a footer:

BREAKING CHANGE: explain what changed, who is affected, and how to migrate

## Body rules

Add a body only when useful. Use it to explain:
- why the change was needed
- important implementation details
- trade-offs or side effects

## Footer rules

Use footers when relevant, for example:
- BREAKING CHANGE: ...
- Refs: #123
- Closes: #456

## Selection rules

- If the change includes both feature and fix work, prefer splitting into multiple commits.
- If only one commit message is requested, choose the primary intent of the change.
- Do not invent changes not present in the diff or user request.
- Do not output extra commentary when the user asks for a commit message only.

## Output rules

When asked for a commit message:
1. First line must be a valid Conventional Commit header.
2. Add body/footer only if they provide clear value.
3. Return plain text only unless the user asks for alternatives.

## Good examples

feat(auth): add Google OAuth login

fix(upload): prevent duplicate file submissions

docs(readme): clarify local development setup

refactor(api): simplify error mapping

perf(search): cache tag aggregation results

test(payment): add webhook retry coverage

chore(deps): upgrade vite to 6

ci(github): add release workflow

feat(api)!: remove legacy token endpoint

BREAKING CHANGE: clients must migrate from /v1/token to /v2/token

## Bad examples

added new login feature
fix bug
Update stuff
feat: Added New Feature.