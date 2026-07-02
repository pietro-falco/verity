# verity — repository governance

- ADR-first, two-commit lifecycle: every architectural change lands as an ADR under
  `docs/adrs/` first (status: Proposed), reviewed and flipped to Accepted in its own
  commit, before implementation work against it begins. Scaffold/tooling and the ADR
  itself are separate atomic commits.
- Verification discipline: evidence is raw command output — `git show HEAD:<path>`,
  literal file reads, or test/command exit codes. Never accept or produce prose
  descriptions or summaries as evidence of file content, commit state, or test results.
- All repository content (code, comments, commit messages, docs) is in English.
