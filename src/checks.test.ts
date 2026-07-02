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

function initGitRepo(dir: string): void {
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "verity-test@example.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Verity Test"], { cwd: dir });
}

test("git_committed: passes for a committed path, fails for uncommitted/missing paths", () => {
  withTmpDir((dir) => {
    initGitRepo(dir);
    writeFileSync(join(dir, "tracked.txt"), "committed content");
    execFileSync("git", ["add", "tracked.txt"], { cwd: dir });
    execFileSync("git", ["commit", "-q", "-m", "init"], { cwd: dir });
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
    execFileSync("git", ["add", "tracked.txt"], { cwd: dir });
    execFileSync("git", ["commit", "-q", "-m", "init"], { cwd: dir });
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
