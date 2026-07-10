# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
