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

export interface ClaimResult {
  id: string;
  type: Claim["type"];
  subject: string;
  predicate: string;
  verdict: Verdict;
  evidence: string;
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
