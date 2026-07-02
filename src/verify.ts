import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runClaim } from "./checks.js";
import type { Claim, ClaimResult, Manifest, MatchSpec, VerifyReport } from "./types.js";
import { VerityUsageError } from "./types.js";

export const DEFAULT_MANIFEST_PATH = ".verity/claims.json";

const CLAIM_TYPES = new Set(["file_exists", "file_matches", "git_committed", "command"]);
const MATCH_KINDS = new Set(["substring", "regex", "sha256"]);

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new VerityUsageError(`expected non-empty string for "${field}", got ${JSON.stringify(value)}`);
  }
}

function validateMatchSpec(value: unknown, field: string): MatchSpec {
  if (typeof value !== "object" || value === null) {
    throw new VerityUsageError(`expected match object for "${field}"`);
  }
  const match = value as Record<string, unknown>;
  if (!MATCH_KINDS.has(match.kind as string)) {
    throw new VerityUsageError(`unknown match kind "${String(match.kind)}" in "${field}"`);
  }
  assertString(match.value, `${field}.value`);
  if (match.flags !== undefined && typeof match.flags !== "string") {
    throw new VerityUsageError(`expected string for "${field}.flags"`);
  }
  return { kind: match.kind as MatchSpec["kind"], value: match.value, flags: match.flags as string | undefined };
}

function validateClaim(raw: unknown, index: number): Claim {
  if (typeof raw !== "object" || raw === null) {
    throw new VerityUsageError(`claim[${index}] is not an object`);
  }
  const claim = raw as Record<string, unknown>;
  assertString(claim.id, `claim[${index}].id`);
  if (!CLAIM_TYPES.has(claim.type as string)) {
    throw new VerityUsageError(`claim "${claim.id}" has unknown claim type "${String(claim.type)}"`);
  }
  const description = claim.description !== undefined ? String(claim.description) : undefined;

  switch (claim.type) {
    case "file_exists": {
      assertString(claim.path, `claim "${claim.id}".path`);
      if (claim.nonEmpty !== undefined && typeof claim.nonEmpty !== "boolean") {
        throw new VerityUsageError(`claim "${claim.id}".nonEmpty must be boolean`);
      }
      return {
        id: claim.id,
        type: "file_exists",
        description,
        path: claim.path,
        nonEmpty: claim.nonEmpty as boolean | undefined,
      };
    }
    case "file_matches": {
      assertString(claim.path, `claim "${claim.id}".path`);
      const match = validateMatchSpec(claim.match, `claim "${claim.id}".match`);
      return { id: claim.id, type: "file_matches", description, path: claim.path, match };
    }
    case "git_committed": {
      assertString(claim.path, `claim "${claim.id}".path`);
      const match = claim.match !== undefined ? validateMatchSpec(claim.match, `claim "${claim.id}".match`) : undefined;
      return { id: claim.id, type: "git_committed", description, path: claim.path, match };
    }
    case "command": {
      assertString(claim.run, `claim "${claim.id}".run`);
      if (claim.cwd !== undefined) assertString(claim.cwd, `claim "${claim.id}".cwd`);
      if (claim.timeoutMs !== undefined && typeof claim.timeoutMs !== "number") {
        throw new VerityUsageError(`claim "${claim.id}".timeoutMs must be a number`);
      }
      if (typeof claim.expect !== "object" || claim.expect === null) {
        throw new VerityUsageError(`claim "${claim.id}".expect is required`);
      }
      const expectRaw = claim.expect as Record<string, unknown>;
      if (expectRaw.exitCode !== undefined && typeof expectRaw.exitCode !== "number") {
        throw new VerityUsageError(`claim "${claim.id}".expect.exitCode must be a number`);
      }
      const stdout = expectRaw.stdout !== undefined ? validateMatchSpec(expectRaw.stdout, `claim "${claim.id}".expect.stdout`) : undefined;
      return {
        id: claim.id,
        type: "command",
        description,
        run: claim.run,
        cwd: claim.cwd as string | undefined,
        timeoutMs: claim.timeoutMs as number | undefined,
        expect: { exitCode: expectRaw.exitCode as number | undefined, stdout },
      };
    }
    default:
      throw new VerityUsageError(`claim "${claim.id}" has unknown claim type "${String(claim.type)}"`);
  }
}

export function parseManifest(raw: unknown): Manifest {
  if (typeof raw !== "object" || raw === null) {
    throw new VerityUsageError("manifest root must be an object");
  }
  const data = raw as Record<string, unknown>;
  assertString(data.version, "version");
  if (!Array.isArray(data.claims)) {
    throw new VerityUsageError('manifest "claims" must be an array');
  }
  const seenIds = new Set<string>();
  const claims = data.claims.map((c, i) => {
    const claim = validateClaim(c, i);
    if (seenIds.has(claim.id)) {
      throw new VerityUsageError(`duplicate claim id "${claim.id}"`);
    }
    seenIds.add(claim.id);
    return claim;
  });
  return { version: data.version, claims };
}

export function loadManifest(manifestPath: string): Manifest {
  let text: string;
  try {
    text = readFileSync(manifestPath, "utf8");
  } catch (err) {
    throw new VerityUsageError(`manifest not found at ${manifestPath}: ${(err as Error).message}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new VerityUsageError(`invalid JSON in manifest ${manifestPath}: ${(err as Error).message}`);
  }

  return parseManifest(json);
}

export function getRepoRoot(cwd: string): string | null {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" });
  if (result.status !== 0) return null;
  return result.stdout.trim();
}

export function getGitHeadSha(cwd: string): string | null {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" });
  if (result.status !== 0) return null;
  return result.stdout.trim();
}

export function getToolVersion(): string {
  const pkgPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
  return pkg.version;
}

export interface VerifyOutcome {
  report: VerifyReport;
  exitCode: 0 | 1;
}

export function verify(manifestPath: string, cwd: string = process.cwd()): VerifyOutcome {
  const absManifestPath = resolve(cwd, manifestPath);
  const manifest = loadManifest(absManifestPath);
  const repoRoot = getRepoRoot(cwd);

  const results: ClaimResult[] = manifest.claims.map((claim) => runClaim(claim, { cwd, repoRoot }));

  const report: VerifyReport = {
    version: getToolVersion(),
    timestamp: new Date().toISOString(),
    gitHeadSha: getGitHeadSha(cwd),
    results,
  };

  const exitCode = results.every((r) => r.verdict === "PASS") ? 0 : 1;
  return { report, exitCode };
}
