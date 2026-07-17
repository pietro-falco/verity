# verity — repository governance

- ADR-first, two-commit lifecycle: every architectural change lands as an ADR under
  `docs/adrs/` first (status: Proposed), reviewed and flipped to Accepted in its own
  commit, before implementation work against it begins. Scaffold/tooling and the ADR
  itself are separate atomic commits.
- Verification discipline: evidence is raw command output — `git show HEAD:<path>`,
  literal file reads, or test/command exit codes. Never accept or produce prose
  descriptions or summaries as evidence of file content, commit state, or test results.
- All repository content (code, comments, commit messages, docs) is in English.
- Gate: `npm run build && npm test`, then self-host — `node dist/cli.js verify`
  (defaults to `.verity/claims.json`). verity must pass its own claims before any
  change is called done.
- Determinism: checks never touch the network and never call an LLM. A check is a
  command with an expected result; nothing probabilistic decides truth. verity is the
  layer the rest of the stack is judged by, so it must stay independently trustable —
  zero dependencies is a feature, not an accident.
- Stack context and the authoritative agent contract live in harness-pack:
  [`docs/STACK.md` § Agent contract](https://github.com/pietro-falco/harness-pack/blob/main/docs/STACK.md#agent-contract).
  This file is a thin projection of that section.
