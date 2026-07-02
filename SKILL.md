---
name: verity
description: Use after completing a coding task, to produce a verifiable receipt of what was actually done instead of a prose claim of completion.
---

## What this does

verity reconciles your claims about a task against literal reality — files
on disk, git history, real command exit codes. The human reviewing your work
trusts the receipt it produces, not your narration of what you did.

## Workflow

1. After finishing the task, write `.verity/claims.json` declaring
   verifiable claims about what you did. One claim per meaningful assertion:
   - Files you created or modified → `file_exists` / `file_matches`.
   - Work you committed → `git_committed`.
   - "Tests pass" / "build passes" → `command` claims that actually run
     the test suite / build, not claims that assume the outcome.
2. Run `npx verity verify` (or, in a development checkout of verity itself,
   `node dist/cli.js verify`).
3. Paste the full raw report output back to the human — never summarize it.
4. If any claim FAILs, either fix the underlying work or correct the claim,
   then rerun. If you change a claim to make it pass, disclose that you did
   so and why — never silently edit a claim just to turn a FAIL into a PASS.

## Example `.verity/claims.json`

```json
{
  "version": "0.1",
  "claims": [
    {
      "id": "readme-updated",
      "type": "file_matches",
      "path": "README.md",
      "match": { "kind": "substring", "value": "## Installation" }
    },
    {
      "id": "fix-committed",
      "type": "git_committed",
      "path": "src/parser.ts",
      "match": { "kind": "substring", "value": "function parseHeader" }
    },
    {
      "id": "tests-pass",
      "type": "command",
      "run": "npm test",
      "expect": { "exitCode": 0 }
    },
    {
      "id": "build-passes",
      "type": "command",
      "run": "npm run build",
      "expect": { "exitCode": 0 }
    }
  ]
}
```

## Rules

- Claims must be falsifiable and specific — "it works" is not a claim;
  "`npm test` exits 0" is.
- Prefer `git_committed` over `file_exists` / `file_matches` when the task
  said the work should be committed — a file existing in the working tree
  is not the same claim as a file being committed.
- Keep `command` claims fast and side-effect-free; they run for real, every
  verification.
- Add `.verity/reports/` to your project's `.gitignore` — receipts are
  generated artifacts, not source.
