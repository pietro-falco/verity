import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
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
  /**
   * ADR-002 D2. The digest this outcome computed, when it computed one.
   *
   * "The value exists in a local variable. Only the slot is missing." This is
   * that slot, and it costs no I/O: the `sha256` branch already hashes the
   * buffer in order to compare it, and until now the hex reached the caller
   * only by being interpolated into an English sentence.
   */
  digest?: string;
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
      // Carried on BOTH verdicts. A FAILing claim's digest is the digest of
      // what is actually there, which is exactly what a consumer diagnosing the
      // failure needs; withholding it on FAIL would make the field a property
      // of the verdict rather than of the subject, which is not what D1's name
      // promises.
      digest: digest.toLowerCase(),
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

/**
 * ADR-002 D3 — this type NEVER populates `subjectDigest`, and the reason is
 * written here rather than left to be rediscovered.
 *
 * `statSync` never reads the file. Emitting a digest would mean reading the
 * bytes: NEW I/O, and a real change of cost on a claim whose entire point is
 * that it is cheap — a manifest may declare hundreds of `file_exists` claims
 * precisely because each is one `stat`. This is a deliberate non-decision with
 * its cost named, not an omission: it is the one type where a digest would be a
 * behavioural change rather than an extraction. Anyone who later wants it must
 * argue the cost, not discover it.
 */
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
      // ADR-002 D5. This was `does not exist at ${abs}` -- absolute and
      // host-specific by construction, since `abs = resolve(ctx.cwd, claim.path)`
      // above. It is the MEASURED origin of both leaks in the receipt corpus:
      // N3-PUBLISH.md censused 49 receipts and found 2 carrying the operator's
      // home directory, at .contribution.baseline.claims[*].evidence, which is
      // this branch. `claim.path` is already the value of `subject` on this same
      // return and is relative by construction.
      //
      // The information is relocated, not lost: `ctx.cwd` is the consumer's own
      // context, so a consumer that needs an absolute path can resolve one --
      // while a consumer that receives one it did not want cannot un-receive it.
      // That asymmetry is what decides this.
      evidence: `does not exist at ${claim.path}`,
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
      // ADR-002 D5, SECOND SITE. The proposed text called this "an OS error
      // message, whose content is the platform's, not this file's". Measured at
      // the ADR's own basis, that reading was wrong twice over: the line
      // interpolated `${abs}` -- this file's own resolved absolute path -- and
      // the Node message it passed through carries the absolute path AGAIN
      // ("ENOENT: no such file or directory, open '/…'"). So the FAIL branch of
      // file_matches disclosed the host path twice per occurrence.
      //
      // `err.code` is kept because the diagnostic class is the informative part
      // -- ENOENT and EACCES are different problems -- and `err.message` is
      // dropped because the platform decides what goes in it, and on this
      // platform what goes in it is a path.
      evidence: `file not found at ${claim.path}: ${(err as NodeJS.ErrnoException).code ?? "read failed"}`,
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
    // ADR-002 D2: file_matches populates the slot when the claim declared a
    // sha256 match, which is the case matchBuffer computes a digest on. No new
    // I/O -- the bytes are already read and already hashed.
    ...(outcome.digest ? { subjectDigest: { sha256: outcome.digest } } : {}),
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

  // git show HEAD:<path> requires posix separators regardless of platform.
  const repoRelativePath = relative(ctx.repoRoot, resolve(ctx.cwd, claim.path)).split(sep).join("/");

  const result = spawnSync("git", ["show", `HEAD:${repoRelativePath}`], {
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
      evidence: `git show HEAD:${repoRelativePath} exit ${result.status}${stderr ? `; stderr: ${stderr}` : ""}`,
    };
  }

  if (!claim.match) {
    return {
      id: claim.id,
      type: claim.type,
      subject: claim.path,
      predicate,
      verdict: "PASS",
      evidence: `git show HEAD:${repoRelativePath} exit 0`,
    };
  }

  const outcome = matchBuffer(result.stdout ?? Buffer.alloc(0), claim.match);
  return {
    id: claim.id,
    type: claim.type,
    subject: claim.path,
    predicate,
    verdict: outcome.pass ? "PASS" : "FAIL",
    evidence: `git show HEAD:${repoRelativePath} exit 0; ${outcome.evidence}`,
    // ADR-002 D2, and this is the BEST-PLACED of the four types -- not for
    // convenience but because it is the only one measuring something immutable
    // by construction: a blob at HEAD, not a working-tree file that may differ
    // by the time anyone reads the result. resource_descriptor.md:51 asks a
    // producer to set `digest` "to denote an immutable artifact or resource",
    // and this is the one type that can honour that unconditionally.
    //
    // Only when a `match` was declared. Whether git_committed should digest the
    // bytes it holds when no match is declared -- it has them, and the digest is
    // one createHash away -- is ADR-002 OR-1 and is deliberately not decided
    // here: it would make a digest appear where a user declared no interest in
    // one.
    ...(outcome.digest ? { subjectDigest: { sha256: outcome.digest } } : {}),
  };
}

const DEFAULT_COMMAND_TIMEOUT_MS = 60_000;

/**
 * ADR-002 D4 — this type NEVER populates `subjectDigest`, and the near-miss is
 * worth refusing explicitly.
 *
 * Its `subject` is `claim.run`, a command line. A command line is not an
 * artifact; there is nothing whose digest would mean anything.
 *
 * The near-miss: with `expect.stdout.kind === "sha256"`, `matchBuffer` below
 * DOES compute a digest of `result.stdout`, and that outcome now carries it in
 * `outcome.digest`. It is deliberately not used. **Stdout is a different object
 * than the one the claim measures** — a `command` claim asserts whatever the
 * command chose to check, and its output is a report about that assertion, not
 * the assertion's subject. Putting it in `subjectDigest` would place a digest
 * under a name that promises the subject, which is the exact ambiguity that
 * field name was chosen to prevent. This type is opaque by design and stays so.
 */
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
