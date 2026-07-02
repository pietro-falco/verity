# verity

[![CI](https://github.com/pietro-falco/verity/actions/workflows/ci.yml/badge.svg)](https://github.com/pietro-falco/verity/actions/workflows/ci.yml)

Turn your coding agent's "done" into a receipt you can check — deterministic, local, zero-dependency.

Status: pre-alpha

## The problem

Coding agents produce plausible narratives about the work they performed.
"Done" is a claim, not a receipt. A rules file (CLAUDE.md, Cursor rules,
AGENTS.md) can ask an agent to be honest about what it did — it cannot
verify that it was. verity checks the claim instead of trusting the
narration: it moves trust from what the agent says it did to evidence a
human (or another process) can inspect directly.

## How it works (30 seconds)

The agent — or you — declares a set of claims in `.verity/claims.json`.
verity runs one deterministic check per claim against literal reality: the
filesystem, a git repository's `HEAD` via `git show`, or a real command's
actual exit code. You get a ✓/✗ receipt on stdout and a JSON report on disk.
The process exits `1` if anything fails, so it gates scripts and CI as
easily as it informs a human review.

```json
{
  "version": "0.1",
  "claims": [
    { "id": "tests-pass", "type": "command", "run": "npm test", "expect": { "exitCode": 0 } }
  ]
}
```

```
$ verity verify
✓ tests-pass [command] command exits 0 — exit 0

1 passed, 0 failed
OVERALL: PASS
```

## Install / Quickstart

**`npx @pietro-falco/verity verify`** — the zero-install path. Run it in any
project with a `.verity/claims.json` manifest.

**From source (for development):**

```
git clone https://github.com/pietro-falco/verity.git
cd verity
npm install
npm run build
node dist/cli.js verify
```

## Claim types

| type            | asserts                                   | key fields                          |
| ---------------- | ------------------------------------------ | ------------------------------------ |
| `file_exists`    | a path exists (optionally non-empty)      | `path`, `nonEmpty`                  |
| `file_matches`   | file content matches                      | `path`, `match`                     |
| `git_committed`  | path is committed at `HEAD`               | `path`, `match` (against committed content) |
| `command`        | a command's exit code / stdout            | `run`, `cwd`, `timeoutMs`, `expect` |

`match` is `{ kind: "substring" | "regex" | "sha256", value, flags? }`. Full
field-by-field semantics, defaults, and PASS conditions are in
[`docs/spec.md`](docs/spec.md).

## For coding agents

[`SKILL.md`](SKILL.md) is a cross-agent skill any coding agent can load. The
loop it describes: emit `.verity/claims.json` after finishing a task → run
`verity verify` → paste the full raw receipt back to the human, unedited.

## Scope and non-goals

verity does not judge semantic correctness (whether the code is *good*,
only whether the declared claim is *true*), does not sign anything in v0,
and does not orchestrate workflows. See
[`docs/adrs/0001-verity-architecture.md`](docs/adrs/0001-verity-architecture.md)
for the full reasoning. Where it sits relative to adjacent controls: rules
files request behavior; commit/CI hooks enforce process at commit time;
supply-chain attestation (SLSA/in-toto) covers release artifacts post-build;
verity reconciles task-level claims at review time — standalone, offline,
in the development loop itself.

## Design choices

- **Zero runtime dependencies.** Node built-ins only — the whole tool is
  auditable in minutes, with near-zero supply-chain surface.
- **Deterministic and offline.** No network calls, no LLM in the loop. Same
  inputs, same verdicts, every time.
- **In-toto-inspired vocabulary.** Receipts use `subject` / `predicate` /
  `evidence` / `verdict`, borrowed for interoperability with other
  evidence-consuming tooling.

## Verifying verity

This repository verifies itself: [`.verity/claims.json`](.verity/claims.json)
declares claims about verity's own README, license, ADR status, docs, and
test suite. Run it with:

```
node dist/cli.js verify
```

## License

MIT — see [`LICENSE`](LICENSE).
