# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅        |

## Threat model

verity has zero runtime dependencies (Node built-ins only) and makes no
network calls of its own. It reads and writes only what a project's
`.verity/claims.json` manifest declares:

- `file_exists` / `file_matches` / `git_committed` claims are read-only
  against the filesystem or `git show HEAD`.
- `command` claims execute the `run` string declared in the manifest,
  exactly as `npm test` executes a project's own scripts. Running
  `verity verify` against an untrusted repository executes that
  repository's declared commands: read the claims manifest first.

## Reporting a vulnerability

Please use GitHub private vulnerability reporting on this repository
(Security → Report a vulnerability) or email
`pietrofalco.dev@gmail.com`. Do not open public issues for security
reports. You can expect an acknowledgment within 72 hours.
