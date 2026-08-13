---
type: adr
status: accepted
title: "Structured evidence: the digest exists, only the slot is missing"
id: ADR-002
date: 2026-08-13
related-adrs: [verity/ADR-001, harness-pack/ADR-018, harness-pack/ADR-019, harness-pack/ADR-020, vault/ADR-051, vault/ADR-080]
---

# ADR-002 — Structured Evidence: the Digest Exists

## Status

Accepted 2026-08-13 by direct operator ratification, on the text committed at
`d90f8dc03facc3d257d1a228cd0dae8e9183e3bb`, git blob
`17d20ac3392a28c0f0be080472309f4da7017071`. Originally proposed 2026-08-13 as a
docs-only commit. Acceptance requires operator review and a separate ratification
commit; this is that commit, and on the precedent `harness-pack/ADR-018`,
`ADR-019` and `ADR-020` set, **the ratification commit is the implementing
commit**.

Four things ship, and they are the whole of what this decision costs:

- **The slot.** `ClaimResult.subjectDigest?: DigestSet` in `src/types.ts`, with
  `DigestSet` exported as `Record<string, string>` — the algorithm as a key,
  never as a field name.
- **The two producers.** `file_matches` and `git_committed` populate it when the
  claim declared a `sha256` match. No new I/O: `matchBuffer` already hashed the
  buffer in order to compare it, and the hex previously reached the caller only
  by being interpolated into an English sentence. `MatchOutcome` gains an
  optional `digest` to carry it out.
- **The two refusals, with their reasons in the code.** `file_exists` and
  `command` never populate it, and D3's and D4's arguments are restated as
  doc-comments at each refusal site rather than left in this document alone.
- **Three tests**, in `src/checks.test.ts`.

**The three tests were run against the PRE-CHANGE `src/checks.ts` and all three
failed**, which is what makes them controls rather than descriptions. The D5 one
failed with the exact leak it exists to catch: `d5-2 (FAIL) leaked the absolute
working directory: does not exist at /…/absent.txt`. [verified]

**The ratified text differs from the proposed text on five points, named here
rather than left to a diff. D1 through D4 stand word for word as proposed; D5's
DECISION is unchanged and one measurement inside its rationale is corrected.**

1. This Status block, in place of the nothing-ships-yet paragraph.
2. **The Basis's measurement-documents paragraph**, repointed from
   `${TMPDIR}/attest-s1/` to the tracked manifest in `harness-pack` at
   `.verity/evidence/2026-08-13-attestation-s1/README.md`, with the bytes
   recorded as held in the operator's private governance vault. The digests are
   unchanged, because the bytes are.
3. **D5's closing measurement is corrected, and this is the substantive
   change.** See the correction recorded under D5 and in ledger row A2.
4. The Verification section's rows, whose "Not yet observed" was true when
   written and stopped being true in this commit.
5. The Open requirements and the Assumption ledger: OR-2 closes, OR-3 narrows to
   a measured remainder, and A2 is falsified — by its own falsifier, exactly as
   that row specified.

**The one fact worth putting in the Status block rather than only under D5.**
This document asserted that `src/checks.ts:75` was the only site interpolating a
path this repository resolved to absolute, and carried that as `[assumed]` in
ledger row A2 with the falsifier "Any evidence string, from any type, carrying an
absolute path after D5 lands. This is exactly what D5's fixture is scoped to
catch." The fixture was written, it caught one, and the assumption is false:
`src/checks.ts:114` interpolates `${abs}` as well. The method held — the
document's own falsifier found the document's own error before acceptance
attached to it — and the decision D5 states in its heading, *no evidence string
carries an absolute path*, is implemented at both sites. [verified]

## Numbering and form note

**Both forms below were read from this repository's own `docs/adrs/`, not
assumed.** At this basis the directory holds exactly one file:
`0001-verity-architecture.md`, `git ls-files docs/adrs/` confirming it is the
only tracked member.

- **Filename form: `NNNN-slug.md`**, four digits. This document takes
  `0002-structured-evidence-the-digest-exists.md`.
- **Self-identifier form: `ADR-NNN`**, three digits. `0001`'s own H1 reads
  `# ADR-001: verity architecture and scope`. This document therefore takes
  `ADR-002` in its `id` and its H1.

**The two forms disagree with each other, and that disagreement is inherited
rather than resolved.** A four-digit filename carrying a three-digit
self-identifier is what is on disk; `vault/ADR-080` D5 builds its selector to
recognise both the `ADR-*.md` and `NNNN-*.md` spellings for exactly this reason,
and `vault/ADR-051` D3 forbids renaming — "Counters remain independent per
namespace and no existing ADR is renamed or renumbered". Normalising would be an
edit to an Accepted record; `vault/ADR-080` rejects that alternative by name.
This document conforms to both observed forms rather than picking one.

**Frontmatter is Form Y** — YAML, per `vault/ADR-080` D1: "Every ADR authored
from acceptance onward uses Form Y. Form H is a reading accommodation for records
already on disk, not a permitted output." `vault/ADR-080` is Accepted
(2026-08-06), and `0001`'s plain-list Form H is precisely the record that
accommodation exists for. `status` is lowercase from D2's closed vocabulary.

**Sweep.** `git grep -nF 'ADR-002'` over this repository returned **zero hits**;
`git grep -nE '0002-'` returned **zero hits**; `ls docs/adrs/0002*` matched
nothing. Counters are per namespace (`vault/ADR-051` D3), so a `002` elsewhere is
not a collision here. [verified]

**`verity/` is not in `vault/ADR-051` D1's prefix registry**, though
`vault/ADR-080`'s namespace table lists it as live at `~/Code/verity/docs/adrs/`.
Registering it is a vault-side act, is not performed here, and is carried as OR-4.

## Basis

Every line number in this document is read against the bases below and is
**pinned here rather than maintained**.

**Repository heads.**

| Repo | Branch | HEAD |
|---|---|---|
| `verity` | `main` | `4dc016b354f3a6eb953590167b46bc29eacf3fcb` |
| `harness-pack` | `main` | `240f8cf9b4602e205c30f313987282cea1eb62bf` |
| vault | `main` | `749b467497ac7dea62d101cdda4075b0c75dae2d` |

Citations into `verity` are read against the committed blob
(`git show HEAD:<path>`); the working tree is clean at this basis
(`git status --porcelain` empty). Citations into `harness-pack` are read against
its committed blobs at the HEAD above.

**Measurement documents.** Cited by digest, **not re-derived**.

Their manifest is tracked in the `harness-pack` repository at
`.verity/evidence/2026-08-13-attestation-s1/README.md`, which carries the path,
sha256 and byte length of every file in the corpus and none of their bytes. The
bytes themselves are held in the **operator's private governance vault**, in a
frozen bundle under the same names. The reason for the split is stated in that
manifest: the measurement documents record absolute home paths and the names of
private repositories, because that is what they measured — `N3-PUBLISH.md`
exists to census receipts across repositories *by path*, and a sanitized census
measures something else — while `harness-pack` is destined to be public and
carries a privacy lint built to keep exactly that material out of tracked files.
Neither fact yields, so **the digest travels and the bytes do not**. A sha256
identifies the bytes it names wherever those bytes are held, which is what makes
the split cost these citations nothing.

**This paragraph replaces a Basis that pointed at `${TMPDIR}/attest-s1/`.** That
location is swept, so the proposed text was a document whose evidence base had an
expiry — and an Accepted ADR is immutable, so the repair had to happen **before**
acceptance attached to it rather than after. `harness-pack/ADR-018`, `ADR-019`
and `ADR-020` all carried the same defect and were repaired the same way; the
manifest's own "Who cites it" table listed this document as the last outstanding
one. The digests below are **unchanged**, because the bytes are. [verified]

| Document | sha256 |
|---|---|
| `N3-PUBLISH.md` | `e7d7a33e4b307c1c99fabad1db22e83aae06cf5692bbd6fef79e795d9645e66e` |
| `N4-VERITY.md` | `0030cbaadfed71a5f05eabe39c6a40a12a9922205b35584265e5216ea7cbfeaa` |

`N4-VERITY.md` is the perimeter survey of this repository: four claim types, each
read for whether it holds a digest of the object it measures. `N3-PUBLISH.md` is
the receipt census that measured the consequence of D5's defect downstream.

**Assertion labels.** `[verified]` — established by an artifact cited here and
re-readable by a third party. `[inferred]` — follows from cited artifacts by an
argument stated at the point of use. `[assumed]` — neither; carried in the
Assumption ledger with its falsifier. An unlabelled assertion is a defect in this
document.

## Context

`ADR-001` chose the vocabulary this document extends: "The evidence report
borrows in-toto vocabulary (subject / predicate / evidence / verdict) for
interoperability", and rejected adopting in-toto as the *primary* layer as the
wrong altitude. Nothing here reopens that. Borrowing one more term from the same
vocabulary is the decision `ADR-001` already made, applied once more. [verified]

`N4-VERITY.md` measured the gap and found it is not where it was assumed to be.
The framing it inherited was "verity emits prose where a digest belongs".
Measured, verity emits prose **containing** the digest: for two of the four claim
types it computes exactly the value a structured field would hold, interpolates
it into a sentence, and discards the structure. **The gap is not capability. It
is type.** [verified]

`src/verify.ts:11` fixes the closed set —
`const CLAIM_TYPES = new Set(["file_exists", "file_matches", "git_committed", "command"])`
— and `src/checks.ts:255-261` dispatches over it. Every type returns the same
shape, `src/types.ts:58-65`:

```
58  export interface ClaimResult {
59    id: string;
60    type: Claim["type"];
61    subject: string;
62    predicate: string;
63    verdict: Verdict;
64    evidence: string;
65  }
```

`evidence` is typed `string`. `subject` is likewise a string — the declared path
or the command line — never a digest. **There is no structured slot anywhere in
the public result type.** [verified]

## Decision

### D1 — `ClaimResult` acquires a structured slot, and the change is additive

One **optional** field is added to `ClaimResult` (`src/types.ts:58-65`), carrying
an in-toto `DigestSet` in the spelling `harness-pack/ADR-018` D2 fixes: a JSON
object mapping algorithm name to lowercase hex, `{"<algorithm-name>": "<hex>"}`.

**Never `{"alg": …, "value": …}`.** That shape folds the algorithm into a
position rather than a key and cannot carry two algorithms without being
restructured; `harness-pack/ADR-018` D2 rejects it, and the algorithm names come
from the in-toto registry it pins — `sha256` for digests over raw bytes,
`gitBlob`/`gitCommit` for git object identifiers. A git object id is never
labelled `sha256`. [verified]

**The name of the field is a decision, and it is `subjectDigest`.** It is named
for *what it is a digest of* — the object named by `subject` — rather than for
its algorithm (which is data, per `harness-pack/ADR-018` D2) or for its shape
(`digestSet` would name the container and leave the referent unstated, which is
the ambiguity that lets a later type populate it with a digest of something else,
as `command` would be tempted to do per D4).

**`evidence` is unchanged, byte for byte, for every type.** No string is
reworded, reordered or reformatted by this decision. D5 changes exactly one
evidence string and says so under its own heading; nothing in D1, D2, D3 or D4
touches one.

**Every existing consumer keeps working.** `harness-pack`'s launcher reads
`r.get("evidence")` at `scripts/launch_worker.sh:303` and would continue to read
it, unchanged and unaware. An optional field is invisible to a reader that does
not ask for it — which is the whole of the compatibility argument, and it is why
D2's fixture has two halves rather than one. [verified]

### D2 — `file_matches` and `git_committed` populate it, at zero I/O cost

**`file_matches`.** `src/checks.ts:23` already computes
`createHash("sha256").update(buf).digest("hex")` over the exact bytes the claim
is about, and `:28` interpolates it into `` `sha256 digest ${digest} matches
expected` ``. The value exists in a local variable. Only the slot is missing.
[verified]

**`git_committed`.** It already reads the committed bytes, at `src/checks.ts:148`:

```
148  const result = spawnSync("git", ["show", `HEAD:${repoRelativePath}`], {
149    cwd: ctx.repoRoot,
150  });
```

That stdout is passed to `matchBuffer` at `:186` and its outcome reaches evidence
at `:193`. [verified]

**`git_committed` is the best-placed type of the four**, and the reason is not
convenience. It is the only type that measures something **immutable by
construction** — a blob at `HEAD`, not a working-tree file that may differ by the
time anyone reads the result. `resource_descriptor.md:51` asks a producer to set
`digest` "to denote an immutable artifact or resource", and this is the one type
that can honour that unconditionally. [verified]

**No new I/O for either.** Both already hold the bytes. The cost of this decision
is a field assignment.

Scope: for `file_matches` the slot is populated when `match.kind === "sha256"`,
the case `src/checks.ts:22` branches on; `MatchKind` already declares `"sha256"`
at `src/types.ts:1`, so no new vocabulary is minted. For `git_committed` the
same condition applies via its optional `match` (`src/types.ts:26-30`). Whether
`git_committed` should additionally digest the bytes it holds when no `match` is
declared — it has them; the digest is one `createHash` away — is real and is
**not decided here**; it is OR-1, because it would make a digest appear where a
user declared no interest in one.

### D3 — `file_exists` does not populate it, and the reason is written

`checkFileExists` calls `statSync(abs)` at `src/checks.ts:67` and **never reads
the file**. Its three returns carry `subject: claim.path` (`:72`, `:83`, `:93`)
and evidence built from a byte count, never from content. [verified]

Emitting a digest here means reading the bytes: **new I/O**, and a real change of
cost on a claim whose entire point is that it is cheap. A manifest may declare
hundreds of `file_exists` claims precisely because each is one `stat`.

This is a **deliberate non-decision with its cost named**, not an omission. It is
the one type where a digest would be a behavioural change rather than an
extraction, and `N4-VERITY.md` says so in the same words. Anyone who later wants
it must argue the cost, not discover it. [verified]

### D4 — `command` does not populate it

Its `subject` is `claim.run`, a command line — `src/checks.ts:215`, `:226`,
`:246` all set `subject: claim.run`. A command line is not an artifact. There is
nothing whose digest would mean anything. [verified]

The near-miss is worth refusing explicitly. With `expect.stdout.kind === "sha256"`,
`matchBuffer` at `:236` does digest `result.stdout`, and the hex does reach
evidence via `:241`. But **stdout is a different object than the one the claim
measures**: a `command` claim asserts whatever the command chose to check, and
its output is a report about that assertion, not the assertion's subject.
Populating `subjectDigest` from stdout would put a digest under a name that
promises the subject — the exact ambiguity D1's field name was chosen to
prevent. This type is opaque by design and stays that way. [verified]

### D5 — No evidence string carries an absolute path

`src/checks.ts:75` emits `` `does not exist at ${abs}` `` where `abs =
resolve(ctx.cwd, claim.path)` (`:62`) — absolute and host-specific by
construction. It is replaced by the **declared** path, `claim.path`, which is
already the value of `subject` on the same return (`:72`) and is relative by
construction.

**This is the measured origin of both leaks in the receipt corpus.**
`N3-PUBLISH.md` censused 49 receipts across four repositories and found **2**
carrying the operator's home directory, at
`.contribution.baseline.claims[*].evidence` — the FAIL branch of this exact line.
It also measured why it is systematic rather than unlucky: the same claim in the
same receipt reads FAIL at t0 with a 67-byte evidence carrying the path, and PASS
at t1 with a 16-byte evidence carrying none. Downstream,
`harness-pack/scripts/launch_worker.sh:335-336` declares a t0 in which every
criterion FAILs to be "the healthy normal case", so **the disclosure correlates
with the run being useful**. [verified]

**This is an observable behaviour change and is declared as one.** Anyone parsing
`evidence` for a FAILing `file_exists` claim gets a relative path where they used
to get an absolute one. Concretely: a log reader who pasted the evidence into a
shell can no longer do so without knowing the working directory, and any
downstream matcher keyed on a `/`-prefixed path stops matching.

The cost is named rather than hidden behind "it is only a message". Two things
bound it. `subject` already carried the relative path on that same return, so
the absolute form was never the only identifier the consumer had. And the
information is not lost, it is relocated: `ctx.cwd` is the consumer's own
context, and a consumer that needs an absolute path can resolve one, whereas a
consumer that receives one it did not want cannot un-receive it — which is the
asymmetry that decides this.

**No other evidence string is touched.** This is the only site in
`src/checks.ts` that interpolates a resolved absolute path; the other host-shaped
strings are OS error messages (`:114`, `:159`, `:218`), whose content is the
platform's, not this file's, and which are OR-3.

---

**CORRECTED AT RATIFICATION. The paragraph above is wrong, and the decision this
section's own heading states is what ships.** Corrected in place rather than
appended, because this document was still Proposed when the error was found and
immutability attaches at acceptance; the original sentence is kept above so the
record shows what was believed before it was measured.

`src/checks.ts:114` — `` `file not found at ${abs}: ${(err as Error).message}` ``
— is **not** an OS error message. It interpolates `${abs}`, this file's own
resolved absolute path, before the platform's message. Read at this document's
own pinned basis `4dc016b`, `git grep -n '\${abs}' src/checks.ts` returns **two**
lines, `:75` and `:114`, and `src/checks.ts` is byte-identical between that basis
and the ratification HEAD, so the error was in the reading and not in a change
since. [verified]

**And the platform's half is worse than the paragraph assumed.** Node's `ENOENT`
message is, measured on this host, verbatim:

```
ENOENT: no such file or directory, open '/…/definitely-absent-xyz'
```

So the FAIL branch of `file_matches` disclosed the absolute path **twice per
occurrence** — once from this file, once from the message it passed through.
Passing the platform's string along was therefore not the neutral act OR-3 took
it for. [verified]

**What ships, at both sites.** `:75` becomes `` `does not exist at ${claim.path}` ``.
`:114` becomes `` `file not found at ${claim.path}: ${err.code}` `` — the
diagnostic **class** is kept, because `ENOENT` and `EACCES` are different
problems and a consumer needs to tell them apart, and `err.message` is dropped,
because the platform decides what goes in it and on this platform what goes in it
is a path.

By contrast `git`'s stderr, measured the same way, is
`fatal: path 'x' does not exist in 'HEAD'` — repo-relative, no absolute path —
so `:159` needed no change and remains OR-3's genuine remainder. The observable
behaviour change declared four paragraphs above now covers `file_matches`'
unreadable-file branch as well as `file_exists`' missing-file branch, on the same
argument and with the same bound: `subject` already carried the relative path on
both returns.

## Verification

Named here, authored at acceptance. Each falsifier declares whether its RED is
**observed** or **predicted**.

**D1 and D2 — the additive-change fixture, in two halves.** The second half is
what makes the change defensible, not the first.

- **(a)** A `file_matches` claim with `match.kind === "sha256"` emits
  `subjectDigest` as a `DigestSet` whose single key is `sha256` and whose value is
  the lowercase hex of the file's bytes — asserted equal to the digest the same
  run interpolates into `evidence`, so that the two cannot drift apart silently.
- **(b)** A consumer reading **only** `evidence` — no knowledge of the new field —
  still passes, on byte-identical output to the pre-change run.

**Not yet observed.** No such field exists, so neither half has a measured RED.
Half (b) is the one that fails if the change is ever quietly made non-additive,
and it is the reason to write it now rather than after.

**PRODUCED AND OBSERVED AT RATIFICATION.** Both halves shipped and both were run
against the pre-change `src/checks.ts` first; both failed there, so neither is a
description of what the code already did.

Half (a) checks the **spelling** and not only the value: one key, that key is the
algorithm, and the object carries neither `alg` nor `value` as a field name — a
test that compared only the hex would accept `harness-pack/ADR-018` D2's rejected
shape. The digest is recomputed from the bytes on disk rather than read back out
of the result, because a digest that only agrees with itself measures nothing. It
also pins the three negatives in the same test: a `substring` claim acquires no
digest, `file_exists` acquires none (D3), and `command` acquires none even when
`expect.stdout.kind === "sha256"` makes `matchBuffer` compute one and put the hex
into `evidence` — D4's near-miss, asserted live rather than described.

Half (b) models the consumer literally: a function whose parameter type is
`{verdict, evidence}` and which therefore **cannot** see the new field. Its two
outputs are pinned to their exact strings rather than to a recording, so a reword
is caught here and not by a downstream parser. [verified]

**D5 — `no_absolute_path_in_evidence`.** A fixture asserting that **no** evidence
string, from **any** of the four types, contains an absolute path.

**RED already observed**, not predicted. `N3-PUBLISH.md` measured 2 receipts of
49 carrying the operator's home directory, named the emitting branch
(`src/checks.ts:75`), and named the two JSON paths that carry it. The fixture's
job is to hold that RED inside this repository's suite — where the defect lives —
rather than inside a measurement document that nothing executes, and rather than
only in the downstream repository that suffered it. [verified]

Its scope is all four types, not just `file_exists`, because a fixture scoped to
the one known site would pass forever the moment a second site appeared. That is
the vacuous-detector shape `harness-pack/ADR-017` names.

**HELD IN THE SUITE AT RATIFICATION, AND THE SCOPE DECISION PAID FOR ITSELF
IMMEDIATELY.** The fixture sweeps nine results — every branch of all four types
that can name a path, PASS and FAIL — and checks each twice: for the run's own
absolute temporary directory, and for an absolute path *by shape* under any
prefix. Run against the pre-change source it failed on `d5-2` with
`does not exist at /…/absent.txt`, the measured leak reproduced in-suite.

**A fixture scoped to `:75` would have shipped this ADR with the second site
intact.** That is not a hypothetical: `:114` is exactly the "second site" the
paragraph above warned about, this document had already classified it as
harmless, and the only thing that caught it was the scope. The correction is
recorded under D5 and in ledger row A2.

The control against the reverse failure — a rule that refuses everything, or a
sweep over strings that all happen to be empty — is that the two branches this
decision changed are pinned to their exact text, `does not exist at absent.txt`
and `file not found at absent.txt: ENOENT`, alongside an assertion that `subject`
still carries the relative path. [verified]

**D3 and D4 — no fixture named here.** Both are decisions *not* to populate a
field. A test asserting a field's absence would pass trivially today, before the
field exists, and would keep passing for the wrong reason afterwards. They become
testable once D1 lands, and they are OR-2.

**WRITTEN AT RATIFICATION, and folded into D1/D2's fixture rather than given
their own.** The premise that held them open is gone: the field exists, so
asserting its absence is no longer trivially true. They are not separate tests
because both assertions need the same fixture body to be non-vacuous — D4's in
particular is only worth anything in the presence of a `command` claim whose
`matchBuffer` genuinely computed a digest, which the same test already
constructs. OR-2 closes.

## Non-goals

- **No new claim type.** The set at `src/verify.ts:11` is unchanged.
- **No change to any `evidence` string except the one D5 names.**
- **No change to `subject` or `predicate`** on any type.
- **No signing, no attestation emission, no transparency log.** This repository
  supplies a digest; what an attestation does with it is
  `harness-pack/ADR-019`'s and `harness-pack/ADR-020`'s business.
- **No new runtime dependency.** `ADR-001` fixes zero runtime dependencies and
  `createHash` is a Node built-in already imported by `src/checks.ts`.
- **No manifest-format change.** `.verity/claims.json` is untouched; this is a
  result-shape decision, not a claims-shape one.

## Open requirements

- **OR-1 — `git_committed` without a declared `match`.** It holds the committed
  bytes and computes no digest today. Whether it should emit one unbidden is
  undecided; D2 scopes the slot to the `sha256` match case only.
- **OR-2 — falsifiers for D3 and D4.** Writable once D1's field exists.

  **CLOSED at ratification.** Both assertions are carried inside D1/D2's fixture,
  for the reason given in Verification: they need that fixture's body to be
  non-vacuous, and D4's needs a `command` claim that genuinely computed a stdout
  digest.
- **OR-3 — OS error messages in evidence.** `src/checks.ts:114`, `:159` and
  `:218` interpolate platform-authored strings that may contain paths this
  repository did not construct. D5 does not reach them; whether an evidence
  string may carry a message this repository did not write is a separate
  decision. D5's fixture, being scoped to all four types, will surface any that
  do — which is the intended way to discover the size of this OR rather than
  guess it.

  **NARROWED at ratification, and the narrowing is a correction rather than
  progress.** `:114` was never an OS-message site: it interpolated `${abs}` in
  its own right, and Node's message carried the path a second time. It is fixed
  under D5 and leaves this OR. What remains here is `:159` and `:218` —
  `git show`'s stderr and a spawn failure — and `:159` was **measured** at
  ratification and is clean: `fatal: path 'x' does not exist in 'HEAD'`,
  repo-relative. `:218` (`command failed to spawn: ${err.message}`) is
  unmeasured and is what this OR now consists of. The last sentence of the
  original text did exactly what it promised — the fixture surfaced the size of
  the OR rather than leaving it to be guessed — and what it surfaced is that the
  OR was mis-scoped in both directions at once. [verified]
- **OR-4 — register `verity/` in `vault/ADR-051` D1's prefix registry.** A
  vault-side act. See the Numbering and form note.

  **OPEN at ratification, and it is open in more than one document.**
  `harness-pack/ADR-020` OR-3 carries the same gap from the other side. It is a
  vault-side act and is delegated to the vault's ADR thread; nothing here can
  close it.

## Consequences

- **The smallest defensible change in the programme lands.** One optional field
  converts a value that is already computed from prose into data. No new
  capability, no new I/O, no new dependency.
- **The receipt-corpus leak closes at its source.** `src/checks.ts:75` is the
  measured origin of both disclosures in the 49-receipt census, and it is one
  line. The downstream repository's publication boundary
  (`harness-pack/ADR-020` D3) still needs to exist — a source fix does not
  retroactively clean 49 files already on disk, and it does not constrain the
  other three carrier classes that repository measured.

  *At ratification: two lines, not one — see the correction under D5. And the
  two decisions landed in the same arc, so the source fix and the publication
  boundary now exist together. That is defence in depth by accident of schedule
  rather than by design, and it is worth noting which one is load-bearing: the
  boundary is, because it constrains carrier classes this repository does not
  own.*
- **The consumers of `evidence` for a FAILing `file_exists` see a different
  string.** Stated in D5 rather than discovered by whoever hits it.
- **`harness-pack` gains nothing from this ADR until it changes a claim.** All
  ten of its claims are `type: command` (`N4-VERITY.md`), the one type that
  structurally cannot produce a subject digest — by D4, and not by any defect
  this ADR could fix. The coupling is real and the obligation is on that side:
  it is `harness-pack/ADR-020` OR-6, not an open requirement here. Naming it
  here matters because a reader would otherwise expect a benefit that will not
  arrive. [verified]

## Assumption ledger

Every `[assumed]` in this document, with the observation that would falsify it.

| # | Assumption | Falsifier |
|---|---|---|
| A1 | **[assumed]** No consumer outside this repository parses `evidence` **structurally** — by regex, split, or field extraction — such that adding a sibling field or changing the `file_exists` FAIL string would break it. The one consumer read is `harness-pack/scripts/launch_worker.sh:303`, which passes the whole string through opaquely. | Any consumer, in any repository, matching on evidence's internal shape. D2's fixture half (b) covers only the opaque-passthrough consumer; a structural parser would break on D5 and the fixture would not notice. This is the assumption most likely to be wrong, because verity is distributed via npm and its consumers are not all enumerable from here. |
| A2 | **[assumed]** `src/checks.ts:75` is the only site in this repository that interpolates a path this repository resolved to absolute. Established by reading the file, not by a tool that proves absence. | Any evidence string, from any type, carrying an absolute path after D5 lands. This is exactly what D5's fixture is scoped to catch, which is why its scope is all four types rather than the one known site. **FALSIFIED AT RATIFICATION, by this row's own falsifier, before acceptance attached.** `src/checks.ts:114` interpolates `${abs}` as well: `git grep -n '\${abs}' src/checks.ts` returns two lines at this document's own pinned basis, and the file is byte-identical between that basis and the ratification HEAD, so the error was in the reading. The assumption's *method* is what held — the row named the observation that would kill it, the fixture was built to make that observation, and it made it on the first run. Both sites are fixed. The row is retired rather than rewritten: what would now be assumed is that a `git grep` for `${abs}` enumerates every way a path can become absolute in this file, and that is a narrower and checkable claim, not an assumption. |
| A3 | **[assumed]** The receipt census's finding that both leaks came from this line generalises — i.e. no other verity output path has leaked into a receipt without being measured. The census covered receipts on disk; it did not enumerate every string this repository can emit. | A receipt or Statement carrying a host path traceable to a verity site other than `:75`. Falsification does not weaken D5; it widens OR-3. |
