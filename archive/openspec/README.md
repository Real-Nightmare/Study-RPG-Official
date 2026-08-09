# Archived: OpenSpec Workspace

This directory holds the **legacy OpenSpec workspace** of the Studyield / Study RPG repository.

## What happened

On **2026-08-06** the project migrated from OpenSpec to **GitHub Spec Kit** (Specify CLI 0.16.0,
GitHub Copilot integration) as the spec-driven development workflow. All active specifications
were migrated to `specs/` (see `specs/README.md` for the index), and this directory was archived
for history.

## Contents

- `specs/` — the 8 original OpenSpec specifications (studyield-core, student-dashboard,
  rag-vector-index, rag-evaluation, rag-deletion, rag-reranking, study-rpg-core, pvp-duels).
- `changes/` — OpenSpec change proposals, designs, and tasks, including the
  `2026-08-06-phase6-study-community` community track (now `specs/009-phase6-study-community/`).
- `config.yaml` — the OpenSpec CLI configuration.
- `github-hooks/` — the OpenSpec agent hooks that previously lived in `.github/skills/`
  (`openspec-*`) and `.github/prompts/` (`opsx-*`), preserved here so nothing is lost.

## Restoring (if ever needed)

- The OpenSpec CLI (`npx openspec`) can reinstall its skills/prompts; the archived originals are
  also here under `github-hooks/`.
- **Do not** create new openspec changes — new features go through `/speckit.*` in `specs/`.
