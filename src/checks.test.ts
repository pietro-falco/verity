import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

// ---------------------------------------------------------------------------
// ADR-002 — structured evidence: the digest exists, only the slot was missing.
//
// Three fixtures, and the second is the one that makes the change defensible as
// ADDITIVE rather than merely small. A field nobody reads is not compatible
// because the type system marks it optional; it is compatible because an
// existing consumer reading only `evidence` still reaches the same verdict on
// the same input. That is measured below rather than asserted.
// ---------------------------------------------------------------------------

test("ADR-002 D2: file_matches emits the structured digest, in ADR-018 D2's spelling", () => {
  withTmpDir((dir) => {
    const content = "hello world";
    writeFileSync(join(dir, "a.txt"), content);
    const expected = createHash("sha256").update(Buffer.from(content)).digest("hex");
    const ctx: CheckContext = { cwd: dir, repoRoot: null };

    const pass = checkFileMatches(
      { id: "fm-digest-1", type: "file_matches", path: "a.txt", match: { kind: "sha256", value: expected } },
      ctx,
    );
    assert.equal(pass.verdict, "PASS");
    // The DigestSet spelling: the algorithm is a KEY, the hex is its value.
    // Never {"alg": ..., "value": ...} -- harness-pack/ADR-018 D2 rejects that
    // shape, and a fixture that only checked the hex would not notice which of
    // the two it got.
    assert.deepEqual(pass.subjectDigest, { sha256: expected });
    assert.ok(!("alg" in (pass.subjectDigest ?? {})), "the algorithm is a key, never a field named alg");
    assert.ok(!("value" in (pass.subjectDigest ?? {})), "the hex is a value, never a field named value");
    // Recomputed from the bytes on disk rather than read back out of the
    // result: a digest that only agrees with itself measures nothing.
    assert.equal(
      pass.subjectDigest?.sha256,
      createHash("sha256").update(readFileSync(join(dir, "a.txt"))).digest("hex"),
    );

    // Carried on FAIL too, and it is the digest of what is ACTUALLY there --
    // which is the value a consumer diagnosing the failure needs.
    const fail = checkFileMatches(
      { id: "fm-digest-2", type: "file_matches", path: "a.txt", match: { kind: "sha256", value: "0".repeat(64) } },
      ctx,
    );
    assert.equal(fail.verdict, "FAIL");
    assert.deepEqual(fail.subjectDigest, { sha256: expected });

    // D2's scope: only when a sha256 match was declared. A substring claim
    // computes no digest and must not acquire one.
    const substring = checkFileMatches(
      { id: "fm-digest-3", type: "file_matches", path: "a.txt", match: { kind: "substring", value: "hello" } },
      ctx,
    );
    assert.equal(substring.verdict, "PASS");
    assert.equal(substring.subjectDigest, undefined);

    // D3: file_exists never reads the bytes, so it has no digest to give.
    const exists = checkFileExists({ id: "fe-digest", type: "file_exists", path: "a.txt" }, ctx);
    assert.equal(exists.verdict, "PASS");
    assert.equal(exists.subjectDigest, undefined);

    // D4's near-miss, and it is a real one: matchBuffer DOES digest stdout here
    // and the hex DOES reach evidence. It must still not reach subjectDigest,
    // because stdout is a different object than the one the claim measures.
    const stdoutDigest = createHash("sha256").update(Buffer.from("hi\n")).digest("hex");
    const cmd = checkCommand(
      {
        id: "cmd-digest",
        type: "command",
        run: "echo hi",
        expect: { exitCode: 0, stdout: { kind: "sha256", value: stdoutDigest } },
      },
      ctx,
    );
    assert.equal(cmd.verdict, "PASS");
    assert.match(cmd.evidence, /sha256 digest/, "the near-miss is real: the hex does reach evidence");
    assert.equal(cmd.subjectDigest, undefined, "D4: stdout is not the subject, so its digest is not subjectDigest");
  });
});

test("ADR-002 D1: a consumer that reads ONLY evidence is unaffected -- the change is additive", () => {
  withTmpDir((dir) => {
    const content = "hello world";
    writeFileSync(join(dir, "a.txt"), content);
    const expected = createHash("sha256").update(Buffer.from(content)).digest("hex");
    const ctx: CheckContext = { cwd: dir, repoRoot: null };

    // harness-pack's launcher reads exactly this and nothing else
    // (scripts/launch_worker.sh:303, `r.get("evidence")`). Modelled literally
    // rather than described: this consumer CANNOT see subjectDigest.
    const legacyConsumer = (r: { verdict: string; evidence: string }) => `${r.verdict}:${r.evidence}`;

    const pass = checkFileMatches(
      { id: "fm-compat-1", type: "file_matches", path: "a.txt", match: { kind: "sha256", value: expected } },
      ctx,
    );
    const fail = checkFileMatches(
      { id: "fm-compat-2", type: "file_matches", path: "a.txt", match: { kind: "sha256", value: "0".repeat(64) } },
      ctx,
    );

    // The evidence strings ADR-002 D1 promises are unchanged "byte for byte".
    // Spelled out here rather than compared against a recording, so a reword is
    // caught by this test and not by a downstream parser.
    assert.equal(legacyConsumer(pass), `PASS:sha256 digest ${expected} matches expected`);
    assert.equal(legacyConsumer(fail), `FAIL:sha256 digest ${expected} != expected ${"0".repeat(64)}`);

    // And the field genuinely is there for a consumer that does ask -- otherwise
    // this test would pass trivially against a change that shipped nothing.
    assert.deepEqual(pass.subjectDigest, { sha256: expected });
  });
});

test("ADR-002 D5: no evidence string of any type carries an absolute path", () => {
  withTmpDir((dir) => {
    initGitRepo(dir);
    writeFileSync(join(dir, "present.txt"), "here");
    git(dir, "add", "present.txt");
    git(dir, "commit", "-q", "-m", "init");
    const ctx: CheckContext = { cwd: dir, repoRoot: dir };

    // Every branch that can name a path, PASS and FAIL, across all four types.
    const results = [
      checkFileExists({ id: "d5-1", type: "file_exists", path: "present.txt" }, ctx),
      checkFileExists({ id: "d5-2", type: "file_exists", path: "absent.txt" }, ctx),
      checkFileExists({ id: "d5-3", type: "file_exists", path: "present.txt", nonEmpty: true }, ctx),
      checkFileMatches(
        { id: "d5-4", type: "file_matches", path: "present.txt", match: { kind: "substring", value: "here" } },
        ctx,
      ),
      checkFileMatches(
        { id: "d5-5", type: "file_matches", path: "absent.txt", match: { kind: "substring", value: "here" } },
        ctx,
      ),
      checkFileMatches(
        { id: "d5-6", type: "file_matches", path: "absent.txt", match: { kind: "sha256", value: "0".repeat(64) } },
        ctx,
      ),
      checkGitCommitted({ id: "d5-7", type: "git_committed", path: "present.txt" }, ctx),
      checkGitCommitted({ id: "d5-8", type: "git_committed", path: "absent.txt" }, ctx),
      checkCommand({ id: "d5-9", type: "command", run: "exit 3", expect: { exitCode: 0 } }, ctx),
    ];

    // The RED this fixture holds was measured in the receipt corpus, not
    // predicted: N3-PUBLISH.md censused 49 receipts across four repositories and
    // found 2 carrying the operator's home directory, both from a FAILing
    // file_exists claim. `dir` is this run's own temporary directory and is
    // absolute, so it stands in for the home path the census found.
    for (const r of results) {
      assert.ok(
        !r.evidence.includes(dir),
        `${r.id} (${r.verdict}) leaked the absolute working directory: ${r.evidence}`,
      );
      // By shape as well as by literal: a leak under some other prefix is the
      // same leak. `git show HEAD:<relative>` is exempt by construction -- it
      // carries a repo-relative path with no leading separator.
      assert.ok(
        !/(^|[\s'"(])\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+/.test(r.evidence),
        `${r.id} (${r.verdict}) carries an absolute path by shape: ${r.evidence}`,
      );
    }

    // The control. A loop over strings that all happened to be empty would pass
    // the assertions above while measuring nothing, so the two branches this
    // decision actually changed are pinned to their exact text.
    const absent = results[1]!;
    assert.equal(absent.verdict, "FAIL");
    assert.equal(absent.evidence, "does not exist at absent.txt");
    assert.equal(
      absent.subject,
      "absent.txt",
      "subject already carried the relative path, so the absolute form was never the only identifier a consumer had",
    );

    // The SECOND site, which the proposed D5 text classified as an OS message
    // and which in fact carried the absolute path twice: once via ${abs}, and
    // once again inside Node's own ENOENT text.
    const unreadable = results[4]!;
    assert.equal(unreadable.verdict, "FAIL");
    assert.equal(unreadable.evidence, "file not found at absent.txt: ENOENT");
  });
});
