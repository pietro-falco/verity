# Claims manifest format (v0.1)

This document specifies the `.verity/claims.json` format and the deterministic
verification behavior of `verity verify`. The format version below (`"0.1"`)
is independent from the package version.

## Purpose

A claims manifest declares specific, checkable assertions about a piece of
work — files that should exist, content that should be present, work that
should be committed, commands that should succeed. `verity verify` checks
each claim against literal reality and reports a PASS/FAIL verdict per claim.

## File location and base directory

By convention the manifest lives at `.verity/claims.json`, but any path may
be passed to `verity verify [manifestPath]`.

All relative claim paths (and the default `cwd` for `command` claims) resolve
against a **base directory**, computed from the manifest's own location: the
directory containing the manifest file, or — if that directory is named
`.verity` — its **parent** directory instead, so a manifest at
`.verity/claims.json` resolves paths against the repo root, not against the
`.verity/` directory itself. The process's current working directory is
never used for path resolution, only the manifest's location.

## Manifest shape

```json
{
  "version": "0.1",
  "claims": [
    { "id": "string, unique within the manifest", "type": "...", "description": "optional" }
  ]
}
```

`claims` is an array of claim objects; each `id` must be unique in the manifest.

## Claim types

### `file_exists`

Asserts a path exists, resolved against the base directory.

- `path` (string, required)
- `nonEmpty` (boolean, optional, default `false`) — also requires size > 0.

PASS when the path exists (and, if `nonEmpty`, has size > 0). FAIL otherwise.

### `file_matches`

Asserts a file's content matches a `match` spec, resolved against the base.

- `path` (string, required)
- `match` (MatchSpec, required)

PASS when the file exists and its content satisfies `match`. FAIL if missing
or non-matching.

### `git_committed`

Asserts a path is committed at `HEAD`, verified via `git show HEAD:<path>`
against the git repository containing the base directory — never the
working tree.

- `path` (string, required)
- `match` (MatchSpec, optional) — matched against the **committed** content
  from `git show`, not the working-tree file.

PASS when `git show HEAD:<path>` exits 0 (and, if `match` is present, the
committed content satisfies it). FAIL if there is no enclosing repository,
the path is not committed at `HEAD`, or the match fails.

### `command`

Runs a shell command and asserts its outcome.

- `run` (string, required) — executed via the platform shell.
- `cwd` (string, optional) — defaults to the base directory; resolved
  against the base directory when given.
- `timeoutMs` (number, optional, default `60000`).
- `expect.exitCode` (number, optional, default `0`).
- `expect.stdout` (MatchSpec, optional).

PASS when the command exits within the timeout with the expected exit code
and (if given) `stdout` satisfies `expect.stdout`. FAIL on a non-matching
exit code, non-matching stdout, or a timeout (process is killed, claim FAILs).

## The match object (`MatchSpec`)

```json
{ "kind": "substring" | "regex" | "sha256", "value": "string", "flags": "optional string" }
```

- `substring` — PASS if `value` is found anywhere in the content.
- `regex` — PASS if `new RegExp(value, flags)` matches. `flags` are standard
  JavaScript regex flags (e.g. `"m"`, `"i"`).
- `sha256` — PASS if the SHA-256 digest of the content, as lowercase hex,
  equals `value` compared case-insensitively.

## Exit codes

- `0` — manifest loaded and every claim PASSed.
- `1` — manifest loaded and at least one claim FAILed.
- `2` — usage error: manifest not found, invalid JSON, a schema violation,
  or an unknown claim type.

## The receipt

Every `verity verify` run writes a JSON receipt to
`.verity/reports/<ISO-timestamp>.json` (under the process's current working
directory), regardless of `--json`. `--json` also prints the same JSON to
stdout instead of the human-readable summary.

```json
{
  "version": "package version of the verity binary that produced the report",
  "timestamp": "ISO 8601 timestamp",
  "gitHeadSha": "string | null (best-effort, null if not inside a git repo)",
  "results": [
    {
      "id": "string",
      "type": "file_exists | file_matches | git_committed | command",
      "subject": "the path or command the claim is about",
      "predicate": "human-readable description of what was checked",
      "verdict": "PASS | FAIL",
      "evidence": "human-readable evidence for the verdict"
    }
  ]
}
```

The `subject` / `predicate` / `evidence` / `verdict` vocabulary is borrowed
from in-toto attestation terminology for interoperability — a naming
convention, not a claim of in-toto compliance.

## Versioning

Format version `0.1` and its `0.x` successors are additive: new optional
fields and new claim types may be added without a major bump. An unknown
claim type is a usage error (exit code `2`), not a silently skipped claim.

## Determinism guarantees

Verification is local and offline: no network calls, no LLM involvement.
Given the same manifest and the same filesystem/git/command state, `verity
verify` produces the same verdicts every time. `command` claims are exactly
as deterministic as the command being run.
