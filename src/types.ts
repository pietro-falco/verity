export type MatchKind = "substring" | "regex" | "sha256";

export interface MatchSpec {
  kind: MatchKind;
  value: string;
  flags?: string;
}

interface ClaimBase {
  id: string;
  description?: string;
}

export interface FileExistsClaim extends ClaimBase {
  type: "file_exists";
  path: string;
  nonEmpty?: boolean;
}

export interface FileMatchesClaim extends ClaimBase {
  type: "file_matches";
  path: string;
  match: MatchSpec;
}

export interface GitCommittedClaim extends ClaimBase {
  type: "git_committed";
  path: string;
  match?: MatchSpec;
}

export interface CommandExpect {
  exitCode?: number;
  stdout?: MatchSpec;
}

export interface CommandClaim extends ClaimBase {
  type: "command";
  run: string;
  cwd?: string;
  timeoutMs?: number;
  expect: CommandExpect;
}

export type Claim =
  | FileExistsClaim
  | FileMatchesClaim
  | GitCommittedClaim
  | CommandClaim;

export interface Manifest {
  version: string;
  claims: Claim[];
}

export type Verdict = "PASS" | "FAIL";

/**
 * An in-toto DigestSet: an object mapping ALGORITHM NAME to lowercase hex.
 *
 * The spelling is fixed by harness-pack/ADR-018 D2 and is never
 * `{"alg": ..., "value": ...}`. That rejected shape folds the algorithm into a
 * position rather than a key and cannot carry two algorithms without being
 * restructured. The algorithm names come from the in-toto registry that ADR
 * pins: `sha256` for a digest over raw bytes, `gitBlob`/`gitCommit` for git
 * object identifiers. A git object id is never labelled `sha256`.
 */
export type DigestSet = Record<string, string>;

export interface ClaimResult {
  id: string;
  type: Claim["type"];
  subject: string;
  predicate: string;
  verdict: Verdict;
  evidence: string;
  /**
   * ADR-002 D1. The digest of the object named by `subject`, when this claim
   * type computed one. OPTIONAL, and the optionality is the compatibility
   * argument: a consumer that does not ask for this field cannot see it, so
   * every existing reader of `evidence` keeps working unchanged.
   *
   * Named for WHAT IT IS A DIGEST OF rather than for its algorithm (which is
   * data, per harness-pack/ADR-018 D2) or for its shape — `digestSet` would
   * name the container and leave the referent unstated, which is the ambiguity
   * that would let a later type populate it with a digest of something else.
   *
   * Populated by `file_matches` and `git_committed` only, and only when the
   * claim declared a `sha256` match. `file_exists` and `command` never populate
   * it; D3 and D4 give their reasons, and both reasons are restated at the
   * point of refusal in src/checks.ts rather than left here.
   */
  subjectDigest?: DigestSet;
}

export interface VerifyReport {
  version: string;
  timestamp: string;
  gitHeadSha: string | null;
  results: ClaimResult[];
}

export interface CheckContext {
  /** Directory that file_exists / file_matches paths and command cwd are resolved against. */
  cwd: string;
  /** Git repo root used for git_committed checks; null when not inside a git repo. */
  repoRoot: string | null;
}

export class VerityUsageError extends Error {}
