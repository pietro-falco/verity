import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type {
  CheckContext,
  Claim,
  ClaimResult,
  CommandClaim,
  FileExistsClaim,
  FileMatchesClaim,
  GitCommittedClaim,
  MatchSpec,
} from "./types.ts";

interface MatchOutcome {
  pass: boolean;
  evidence: string;
}

function matchBuffer(buf: Buffer, match: MatchSpec): MatchOutcome {
  if (match.kind === "sha256") {
    const digest = createHash("sha256").update(buf).digest("hex");
    const pass = digest.toLowerCase() === match.value.toLowerCase();
    return {
      pass,
      evidence: pass
        ? `sha256 digest ${digest} matches expected`
        : `sha256 digest ${digest} != expected ${match.value.toLowerCase()}`,
    };
  }

  const text = buf.toString("utf8");
  if (match.kind === "substring") {
    const pass = text.includes(match.value);
    return {
      pass,
      evidence: pass
        ? `substring ${JSON.stringify(match.value)} found`
        : `substring ${JSON.stringify(match.value)} not found (${buf.length} bytes read)`,
    };
  }

  // regex
  const re = new RegExp(match.value, match.flags);
  const pass = re.test(text);
  return {
    pass,
    evidence: pass
      ? `regex /${match.value}/${match.flags ?? ""} matched`
      : `regex /${match.value}/${match.flags ?? ""} did not match (${buf.length} bytes read)`,
  };
}

function describeMatch(match: MatchSpec): string {
  if (match.kind === "sha256") return `sha256 digest equals ${match.value.toLowerCase()}`;
  if (match.kind === "substring") return `content contains substring ${JSON.stringify(match.value)}`;
  return `content matches regex /${match.value}/${match.flags ?? ""}`;
}

export function checkFileExists(claim: FileExistsClaim, ctx: CheckContext): ClaimResult {
  const abs = resolve(ctx.cwd, claim.path);
  const predicate = claim.nonEmpty ? "file exists and is non-empty" : "file exists";

  let stat;
  try {
    stat = statSync(abs);
  } catch {
    return {
      id: claim.id,
      type: claim.type,
      subject: claim.path,
      predicate,
      verdict: "FAIL",
      evidence: `does not exist at ${abs}`,
    };
  }

  if (claim.nonEmpty && stat.size === 0) {
    return {
      id: claim.id,
      type: claim.type,
      subject: claim.path,
      predicate,
      verdict: "FAIL",
      evidence: "exists, 0 bytes (nonEmpty required)",
    };
  }

  return {
    id: claim.id,
    type: claim.type,
    subject: claim.path,
    predicate,
    verdict: "PASS",
    evidence: `exists, ${stat.size} bytes`,
  };
}

export function checkFileMatches(claim: FileMatchesClaim, ctx: CheckContext): ClaimResult {
  const abs = resolve(ctx.cwd, claim.path);
  const predicate = describeMatch(claim.match);

  let buf: Buffer;
  try {
    buf = readFileSync(abs);
  } catch (err) {
    return {
      id: claim.id,
      type: claim.type,
      subject: claim.path,
      predicate,
      verdict: "FAIL",
      evidence: `file not found at ${abs}: ${(err as Error).message}`,
    };
  }

  const outcome = matchBuffer(buf, claim.match);
  return {
    id: claim.id,
    type: claim.type,
    subject: claim.path,
    predicate,
    verdict: outcome.pass ? "PASS" : "FAIL",
    evidence: outcome.evidence,
  };
}

export function checkGitCommitted(claim: GitCommittedClaim, ctx: CheckContext): ClaimResult {
  const predicate = claim.match
    ? `path is committed at HEAD and ${describeMatch(claim.match)}`
    : "path is committed at HEAD";

  if (!ctx.repoRoot) {
    return {
      id: claim.id,
      type: claim.type,
      subject: claim.path,
      predicate,
      verdict: "FAIL",
      evidence: "not inside a git repository",
    };
  }

  const result = spawnSync("git", ["show", `HEAD:${claim.path}`], {
    cwd: ctx.repoRoot,
  });

  if (result.error) {
    return {
      id: claim.id,
      type: claim.type,
      subject: claim.path,
      predicate,
      verdict: "FAIL",
      evidence: `failed to run git: ${result.error.message}`,
    };
  }

  if (result.status !== 0) {
    const stderr = (result.stderr ?? Buffer.alloc(0)).toString("utf8").trim();
    return {
      id: claim.id,
      type: claim.type,
      subject: claim.path,
      predicate,
      verdict: "FAIL",
      evidence: `git show HEAD:${claim.path} exit ${result.status}${stderr ? `; stderr: ${stderr}` : ""}`,
    };
  }

  if (!claim.match) {
    return {
      id: claim.id,
      type: claim.type,
      subject: claim.path,
      predicate,
      verdict: "PASS",
      evidence: `git show HEAD:${claim.path} exit 0`,
    };
  }

  const outcome = matchBuffer(result.stdout ?? Buffer.alloc(0), claim.match);
  return {
    id: claim.id,
    type: claim.type,
    subject: claim.path,
    predicate,
    verdict: outcome.pass ? "PASS" : "FAIL",
    evidence: `git show HEAD:${claim.path} exit 0; ${outcome.evidence}`,
  };
}

const DEFAULT_COMMAND_TIMEOUT_MS = 60_000;

export function checkCommand(claim: CommandClaim, ctx: CheckContext): ClaimResult {
  const expectedExitCode = claim.expect.exitCode ?? 0;
  const timeoutMs = claim.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
  const cwd = claim.cwd ? resolve(ctx.cwd, claim.cwd) : ctx.cwd;
  const predicate = `command exits ${expectedExitCode}${claim.expect.stdout ? ` and stdout ${describeMatch(claim.expect.stdout)}` : ""}`;

  const result = spawnSync(claim.run, {
    shell: true,
    cwd,
    timeout: timeoutMs,
  });

  if (result.error && (result.error as NodeJS.ErrnoException).code !== "ETIMEDOUT") {
    return {
      id: claim.id,
      type: claim.type,
      subject: claim.run,
      predicate,
      verdict: "FAIL",
      evidence: `command failed to spawn: ${result.error.message}`,
    };
  }

  if (result.signal || (result.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT") {
    return {
      id: claim.id,
      type: claim.type,
      subject: claim.run,
      predicate,
      verdict: "FAIL",
      evidence: `command timed out after ${timeoutMs}ms (killed with ${result.signal ?? "SIGTERM"})`,
    };
  }

  const actualExitCode = result.status ?? -1;
  const exitPass = actualExitCode === expectedExitCode;
  const stdoutOutcome = claim.expect.stdout
    ? matchBuffer(result.stdout ?? Buffer.alloc(0), claim.expect.stdout)
    : null;
  const pass = exitPass && (stdoutOutcome === null || stdoutOutcome.pass);

  const parts = [exitPass ? `exit ${actualExitCode}` : `exit ${actualExitCode} (expected ${expectedExitCode})`];
  if (stdoutOutcome) parts.push(`stdout: ${stdoutOutcome.evidence}`);

  return {
    id: claim.id,
    type: claim.type,
    subject: claim.run,
    predicate,
    verdict: pass ? "PASS" : "FAIL",
    evidence: parts.join("; "),
  };
}

export function runClaim(claim: Claim, ctx: CheckContext): ClaimResult {
  switch (claim.type) {
    case "file_exists":
      return checkFileExists(claim, ctx);
    case "file_matches":
      return checkFileMatches(claim, ctx);
    case "git_committed":
      return checkGitCommitted(claim, ctx);
    case "command":
      return checkCommand(claim, ctx);
  }
}
