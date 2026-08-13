import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { checkCommand, checkFileExists, checkFileMatches, checkGitCommitted } from "./checks.ts";
import type { CheckContext } from "./types.ts";

function withTmpDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "verity-checks-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("file_exists: passes when the file exists", () => {
  withTmpDir((dir) => {
    writeFileSync(join(dir, "a.txt"), "hi");
    const ctx: CheckContext = { cwd: dir, repoRoot: null };
    const result = checkFileExists({ id: "fe-1", type: "file_exists", path: "a.txt" }, ctx);
    assert.equal(result.verdict, "PASS");
  });
});

test("file_exists: fails when the file is missing", () => {
  withTmpDir((dir) => {
    const ctx: CheckContext = { cwd: dir, repoRoot: null };
    const result = checkFileExists({ id: "fe-2", type: "file_exists", path: "missing.txt" }, ctx);
    assert.equal(result.verdict, "FAIL");
  });
});

test("file_exists: fails when nonEmpty is required but the file is empty", () => {
  withTmpDir((dir) => {
    writeFileSync(join(dir, "empty.txt"), "");
    const ctx: CheckContext = { cwd: dir, repoRoot: null };
    const result = checkFileExists({ id: "fe-3", type: "file_exists", path: "empty.txt", nonEmpty: true }, ctx);
    assert.equal(result.verdict, "FAIL");
  });
});

test("file_matches: passes when the substring is found", () => {
  withTmpDir((dir) => {
    writeFileSync(join(dir, "a.txt"), "hello world");
    const ctx: CheckContext = { cwd: dir, repoRoot: null };
    const result = checkFileMatches(
      { id: "fm-1", type: "file_matches", path: "a.txt", match: { kind: "substring", value: "hello" } },
      ctx,
    );
    assert.equal(result.verdict, "PASS");
  });
});

test("file_matches: fails when the substring is absent", () => {
  withTmpDir((dir) => {
    writeFileSync(join(dir, "a.txt"), "hello world");
    const ctx: CheckContext = { cwd: dir, repoRoot: null };
    const result = checkFileMatches(
      { id: "fm-2", type: "file_matches", path: "a.txt", match: { kind: "substring", value: "goodbye" } },
      ctx,
    );
    assert.equal(result.verdict, "FAIL");
  });
});

test("file_matches: sha256 kind passes and fails correctly", () => {
  withTmpDir((dir) => {
    writeFileSync(join(dir, "a.txt"), "hello world");
    const ctx: CheckContext = { cwd: dir, repoRoot: null };

    const digest = execFileSync("shasum", ["-a", "256", join(dir, "a.txt")], { encoding: "utf8" })
      .split(" ")[0]!
      .trim();

    const pass = checkFileMatches(
      { id: "fm-3", type: "file_matches", path: "a.txt", match: { kind: "sha256", value: digest } },
      ctx,
    );
    assert.equal(pass.verdict, "PASS");

    const fail = checkFileMatches(
      { id: "fm-4", type: "file_matches", path: "a.txt", match: { kind: "sha256", value: "0".repeat(64) } },
      ctx,
    );
    assert.equal(fail.verdict, "FAIL");
  });
});

test("file_matches: regex kind passes and fails correctly, including flags", () => {
  withTmpDir((dir) => {
    writeFileSync(join(dir, "a.txt"), "Line one\nLine two\nHELLO\n");
    const ctx: CheckContext = { cwd: dir, repoRoot: null };

    const pass = checkFileMatches(
      { id: "fm-5", type: "file_matches", path: "a.txt", match: { kind: "regex", value: "^Line two$", flags: "m" } },
      ctx,
    );
    assert.equal(pass.verdict, "PASS");

    const passCaseInsensitive = checkFileMatches(
      { id: "fm-6", type: "file_matches", path: "a.txt", match: { kind: "regex", value: "^hello$", flags: "im" } },
      ctx,
    );
    assert.equal(passCaseInsensitive.verdict, "PASS");

    const fail = checkFileMatches(
      { id: "fm-7", type: "file_matches", path: "a.txt", match: { kind: "regex", value: "^Line three$", flags: "m" } },
      ctx,
    );
    assert.equal(fail.verdict, "FAIL");
  });
});

/**
 * Every `git` this suite invokes goes through here, and the point is that its
 * configuration is PASSED IN rather than inherited.
 *
 * The defect this closes was measured, not predicted: the scratch repositories
 * below were created with a bare `git init` and then committed to with a bare
 * `git commit`, so they inherited the host's global config. On a host carrying
 * `commit.gpgsign=true` with `gpg.format=ssh` — an ordinary configuration, and
 * this repository's own — `git commit` exits 128 with
 * `error: Couldn't load public key …` / `fatal: failed to write commit object`
 * the moment the signing key is not readable. `execFileSync` throws, and three
 * tests die in their fixture setup without ever reaching the assertion they
 * exist to make. A test that cannot fail for its own reason is not a test.
 *
 * So both halves are pinned:
 *
 * - `GIT_CONFIG_GLOBAL` and `GIT_CONFIG_SYSTEM` are pointed at `/dev/null`, so
 *   NOTHING on the host reaches this git — not signing, not `core.hooksPath`,
 *   not a `commit.template`, and not whatever the next host adds.
 * - Everything these repositories actually need is then supplied explicitly by
 *   `-c`, because with the config files closed off there is no other source.
 *   `user.name`/`user.email` because git refuses to commit without an identity;
 *   `commit.gpgsign=false`/`tag.gpgsign=false` belt-and-braces, so the intent
 *   is legible at the call site rather than resting on the env vars alone;
 *   `init.defaultBranch` so `git init` neither warns nor depends on the host's
 *   choice of name.
 *
 * The criterion is that this suite returns the same verdict on a host with a
 * readable signing key and on a host without one.
 */
function git(dir: string, ...args: string[]): void {
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Verity Test",
      "-c",
      "user.email=verity-test@example.com",
      "-c",
      "commit.gpgsign=false",
      "-c",
      "tag.gpgsign=false",
      "-c",
      "init.defaultBranch=main",
      ...args,
    ],
    {
      cwd: dir,
      env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" },
    },
  );
}

function initGitRepo(dir: string): void {
  git(dir, "init", "-q");
}

test("git_committed: passes for a committed path, fails for uncommitted/missing paths", () => {
  withTmpDir((dir) => {
    initGitRepo(dir);
    writeFileSync(join(dir, "tracked.txt"), "committed content");
    git(dir, "add", "tracked.txt");
    git(dir, "commit", "-q", "-m", "init");
    writeFileSync(join(dir, "untracked.txt"), "never committed");

    const ctx: CheckContext = { cwd: dir, repoRoot: dir };

    const committed = checkGitCommitted({ id: "gc-1", type: "git_committed", path: "tracked.txt" }, ctx);
    assert.equal(committed.verdict, "PASS");

    const uncommitted = checkGitCommitted({ id: "gc-2", type: "git_committed", path: "untracked.txt" }, ctx);
    assert.equal(uncommitted.verdict, "FAIL");

    const missing = checkGitCommitted({ id: "gc-3", type: "git_committed", path: "nope.txt" }, ctx);
    assert.equal(missing.verdict, "FAIL");
  });
});

test("git_committed: applies the match spec against the committed content, not the working tree", () => {
  withTmpDir((dir) => {
    initGitRepo(dir);
    writeFileSync(join(dir, "tracked.txt"), "version one");
    git(dir, "add", "tracked.txt");
    git(dir, "commit", "-q", "-m", "init");
    // Working tree now diverges from HEAD.
    writeFileSync(join(dir, "tracked.txt"), "version two");

    const ctx: CheckContext = { cwd: dir, repoRoot: dir };

    const matchesCommitted = checkGitCommitted(
      { id: "gc-4", type: "git_committed", path: "tracked.txt", match: { kind: "substring", value: "version one" } },
      ctx,
    );
    assert.equal(matchesCommitted.verdict, "PASS");

    const doesNotMatchWorkingTree = checkGitCommitted(
      { id: "gc-5", type: "git_committed", path: "tracked.txt", match: { kind: "substring", value: "version two" } },
      ctx,
    );
    assert.equal(doesNotMatchWorkingTree.verdict, "FAIL");
  });
});

test("command: passes when exit code and stdout match expectations", () => {
  const ctx: CheckContext = { cwd: process.cwd(), repoRoot: null };
  const result = checkCommand(
    {
      id: "cmd-1",
      type: "command",
      run: "echo hi",
      expect: { exitCode: 0, stdout: { kind: "substring", value: "hi" } },
    },
    ctx,
  );
  assert.equal(result.verdict, "PASS");
});

test("command: fails when the exit code does not match", () => {
  const ctx: CheckContext = { cwd: process.cwd(), repoRoot: null };
  const result = checkCommand(
    { id: "cmd-2", type: "command", run: "exit 3", expect: { exitCode: 0 } },
    ctx,
  );
  assert.equal(result.verdict, "FAIL");
});

test("command: fails when exit code matches but stdout does not", () => {
  const ctx: CheckContext = { cwd: process.cwd(), repoRoot: null };
  const result = checkCommand(
    {
      id: "cmd-3",
      type: "command",
      run: "echo hi",
      expect: { exitCode: 0, stdout: { kind: "substring", value: "bye" } },
    },
    ctx,
  );
  assert.equal(result.verdict, "FAIL");
});

test("command: a command that exceeds timeoutMs is killed and FAILs with timeout evidence", () => {
  const ctx: CheckContext = { cwd: process.cwd(), repoRoot: null };
  const result = checkCommand(
    { id: "cmd-4", type: "command", run: "sleep 2", timeoutMs: 200, expect: { exitCode: 0 } },
    ctx,
  );
  assert.equal(result.verdict, "FAIL");
  assert.match(result.evidence, /timed out/);
});
