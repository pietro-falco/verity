import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { verify } from "./verify.ts";

function withTmpDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "verity-verify-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("verify: mixed manifest yields per-claim verdicts, overall FAIL, and exit code 1", () => {
  withTmpDir((dir) => {
    writeFileSync(join(dir, "present.txt"), "content");
    mkdirSync(join(dir, ".verity"));
    writeFileSync(
      join(dir, ".verity", "claims.json"),
      JSON.stringify({
        version: "0.1",
        claims: [
          { id: "pass-1", type: "file_exists", path: "present.txt" },
          { id: "fail-1", type: "file_exists", path: "absent.txt" },
        ],
      }),
    );

    const outcome = verify(".verity/claims.json", dir);

    assert.equal(outcome.exitCode, 1);
    assert.equal(outcome.report.results.length, 2);
    assert.equal(outcome.report.results.find((r) => r.id === "pass-1")?.verdict, "PASS");
    assert.equal(outcome.report.results.find((r) => r.id === "fail-1")?.verdict, "FAIL");
  });
});

test("verify: all-passing manifest yields overall PASS and exit code 0", () => {
  withTmpDir((dir) => {
    writeFileSync(join(dir, "present.txt"), "content");
    mkdirSync(join(dir, ".verity"));
    writeFileSync(
      join(dir, ".verity", "claims.json"),
      JSON.stringify({
        version: "0.1",
        claims: [{ id: "pass-1", type: "file_exists", path: "present.txt" }],
      }),
    );

    const outcome = verify(".verity/claims.json", dir);

    assert.equal(outcome.exitCode, 0);
    assert.equal(outcome.report.results[0]?.verdict, "PASS");
  });
});

test("verify: missing manifest throws a usage error", () => {
  withTmpDir((dir) => {
    assert.throws(() => verify(".verity/claims.json", dir));
  });
});
