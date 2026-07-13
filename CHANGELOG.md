# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.1] - 2026-07-13

- Release workflow (`.github/workflows/release.yml`): tagged releases publish
  to npm via OIDC trusted publishing, so artifacts carry SLSA provenance. The
  release is gated by verity's own claims manifest before publish.
- README quickstart is a runnable block — the `npx -y @pietro-falco/verity
  verify` invocation is verified against the published package.
- `llms.txt` at the repository root, for AI-tool consumption; its definitions
  are sourced from [`docs/spec.md`](docs/spec.md).

## [0.1.0] - 2026-07-02

- Initial release: `verity verify` runs deterministic checks against a
  project's `.verity/claims.json` manifest.
- Four claim types: `file_exists`, `file_matches`, `git_committed`,
  `command` — checked against the filesystem, `git show HEAD`, or a real
  command's exit code.
- Zero runtime dependencies, offline, deterministic — same inputs, same
  verdicts every time.
- ✓/✗ receipt on stdout plus a JSON report on disk; exits `1` on any
  failed claim, so it gates scripts and CI.
- `SKILL.md` ships a cross-agent skill for emitting claims and running
  `verity verify` as part of a coding agent's own workflow.
