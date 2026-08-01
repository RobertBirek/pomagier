---
name: sprint-doc-sync
description: Use after every PR merge to main to synchronize all knowledge files (CHANGELOG, TASKS, DECISIONS, AGENTS, README, PLAN, SECURITY, PRD, TESTING, ARCHITECTURE, API, DB_SCHEMA, .opencode/skills/*). Triggers on: "update docs", "synchronize knowledge files", "commit and push docs", "sync docs", "release docs".
---

# Sprint Documentation Sync

After each PR merged to main, synchronize all knowledge files so the project state
is always consistent across documentation, code, and runtime.

## When to use

- After every PR merge to main (regardless of size)
- User says: "update docs", "synchronize knowledge files", "commit and push docs"
- Before a release / git tag

## Workflow (12 steps)

1. **Audit recent changes**: `git log main --oneline -10` to identify new commits
2. **Identify the changes**: code, schema, API, security, tests, architecture
3. **Build the file list** in priority order (see below)
4. **Show plan to user** with EXACT content for each file (read-only mode)
5. **Wait for "działaj"** approval (this skill respects plan mode)
6. **Apply changes** — edit files in place (no new files for existing info)
7. **Run `npm run format`** to avoid prettier conflicts
8. **Revert unrelated prettier changes** with `git checkout -- <file>`
9. **Run verification**: `npm run typecheck && npm run lint && npm test`
10. **Commit** with message `docs: sync after Sprint N` (1 commit, descriptive body)
11. **Merge fast-forward to main** + **push origin**
12. **(Optional) Tag release**: `git tag -a vX.Y.Z -m "..."` + `git push origin vX.Y.Z`

## Files to update (priority order)

### Tier 1: Critical (always check after every sprint)

1. **CHANGELOG.md** — new section under `[Unreleased]` (or release version)
2. **TASKS.md** — new table for the sprint with all sub-tasks
3. **DECISIONS.md** — new ADR for any architectural choice made
4. **AGENTS.md** — Stan projektu version + test count + skills table + workflow reminder

### Tier 2: High (update if relevant)

5. **README.md** — Stan projektu checklist (add new versions)
6. **PLAN.md** — Stan + kryteria akceptacji + test count
7. **SECURITY.md** — new section for any security change
8. **PRD.md** — Stan version + closed/open decisions
9. **TESTING.md** — test count + list of new test files

### Tier 3: Medium

10. **ARCHITECTURE.md** — update if architecture changed
11. **API.md** — update if endpoints changed (added/removed/deprecated)
12. **DB_SCHEMA.md** — update if schema changed (migrations)

### Tier 4: Stable (rarely change)

13. **DEPLOYMENT.md** — only if deploy flow changed

### Skille (superpowers)

- **`.opencode/skills/*/SKILL.md`** — review and update if:
  - New endpoint/table related to skill
  - Pattern changed
  - New best practice discovered
- **Always update** if a new skill is created (add to AGENTS.md skills table)

## Cross-reference rules (CONSISTENCY!)

These facts MUST be consistent across files:

- **Test count** in: CHANGELOG, TASKS, AGENTS, TESTING.md
- **Version** in: AGENTS (Stan projektu), README (Stan projektu), CHANGELOG (header), PRD, PLAN
- **Date format**: YYYY-MM-DD
- **Commit count for sprint** = `git log --oneline since last sprint`
- **Sprint number** consistent across CHANGELOG, TASKS, DECISIONS

## Anti-patterns

- ❌ **Don't edit unrelated files** — revert prettier-only changes after format
- ❌ **Don't update docs for branches that aren't merged** to main
- ❌ **Don't add new files for existing info** — edit in place
- ❌ **Don't skip test count updates** — always bump the number
- ❌ **Don't skip AGENTS.md skills table** — it's the project index
- ❌ **Don't push without explicit user consent** — even after merge
- ❌ **Don't merge unrelated changes** to the docs commit (e.g., feature code)

## Sprint report template (use in commit body)

```markdown
docs: sync after Sprint N

[One-line summary of what the sprint delivered]

## Files updated

- CHANGELOG.md: [what was added]
- TASKS.md: [what was added]
- DECISIONS.md: [new decisions]
- ... etc

## Test count

- Before: N pass / M skip
- After: N' pass / M' skip (+X new)

## Version

- vX.Y.Z (was vX.Y.W)
```

## Output format

After completion, show user:

- List of files changed (with line counts)
- Test count delta
- New version
- Commit SHA on main
- Branch left for review (if any)
- Tag created (if any)
- URL: `https://github.com/RobertBirek/pomagier/commits/main`
