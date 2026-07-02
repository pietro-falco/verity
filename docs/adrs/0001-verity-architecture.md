# ADR-001: verity architecture and scope

- Status: Proposed
- Date: 2026-07-02
- Deciders: Pietro Falco

## Context

Coding agents fabricate plausible narratives about work performed (ref: lesson L-022:
"CC frequently fabricates plausible narratives from imprecise evidence"). Existing controls
fall into three layers, none of which closes the dev-loop claim-reconciliation gap:

1. Rules files (CLAUDE.md, Cursor rules): request behavior, cannot enforce it.
2. Commit/CI guardrails and hooks: enforce at commit time, are process/security oriented,
   and do not reconcile task-level claims at the human review moment.
3. Supply-chain attestation (SLSA / in-toto / Sigstore): cryptographically attest *release
   artifacts* post-build, not agent *task claims* in the development loop.

Academic proposals (Action Attestation Layer; Pramana claim-verification protocol) identify
the right primitives — receipts, a verify() operation against a recorded source, and a
determinism partition separating deterministically-verifiable claims from LLM-oracle claims —
but are heavyweight and signature-based.

Gap: a lightweight, local, deterministic tool that reconciles an agent's task-level claims
against literal repository / filesystem / command reality, cross-agent.

## Decision

Build verity as a zero-runtime-dependency TypeScript CLI (Node built-ins only), distributed
via npm and runnable with npx. Target Node >= 20; develop and test on Node 24.

Three components:
1. An open claims-manifest format: `.verity/claims.json` (plain JSON, parsed with no deps).
2. A deterministic verifier: one check per claim, emits a human-readable and a JSON evidence
   report, exits non-zero if any claim fails.
3. A cross-agent `SKILL.md` instructing any agent to emit the manifest and run the verifier.

v0 claim types (deterministic only):
- `file_exists` — path exists (optionally non-empty).
- `file_matches` — file content: substring | regex | sha256 digest.
- `git_committed` — path is committed at HEAD, verified via `git show HEAD:<path>`.
- `command` — run a command, assert exit code and optional stdout match.

Testing uses the Node built-in test runner (`node --test`); no test-framework dependency.
The evidence report borrows in-toto vocabulary (subject / predicate / evidence / verdict)
for interoperability.

## Consequences

Positive: minimal supply-chain surface (auditable in minutes); zero-install trial via npx;
deterministic, reproducible, offline, free; automates the L-005 / L-008 / Rule B evidence
discipline; cross-agent via the SKILL.md standard already in use.

Accepted trade-offs: cannot verify semantic correctness or intent (out of scope by the
determinism partition); no tamper-evidence in v0 (an agent editing the manifest is outside
the v0 threat model — the manifest declares what to check; reality is checked independently);
requires the agent to emit a manifest (mitigated by the SKILL.md).

## Non-goals (v0)

Semantic / LLM-oracle claim verification; cryptographic signing or provenance logs; workflow
orchestration or gating (that is the future harness-maker layer, which will consume verity as
its truth component); destructive-command blocking or sandboxing (covered by existing hooks).

## Alternatives considered

- SKILL.md / rules file only: rejected — asks for behavior, cannot verify it.
- Python CLI: rejected for distribution friction (npx > pipx for the coding-agent audience).
- LLM-judge verification: rejected — non-deterministic, costs tokens, not reproducible.
- Adopting SLSA / in-toto as the primary layer: rejected — wrong altitude (release artifacts
  vs dev-loop task claims); vocabulary borrowed for interoperability instead.

If the npm name `verity` is unavailable at publish time, scope the package to
`@pietrofalco/verity`; the bin name stays `verity`.
