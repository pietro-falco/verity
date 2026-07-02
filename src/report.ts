import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { VerifyReport } from "./types.ts";

export function formatHuman(report: VerifyReport): string {
  const lines = report.results.map((r) => {
    const mark = r.verdict === "PASS" ? "✓" : "✗";
    return `${mark} ${r.id} [${r.type}] ${r.predicate} — ${r.evidence}`;
  });

  const passed = report.results.filter((r) => r.verdict === "PASS").length;
  const failed = report.results.length - passed;
  const overall = failed === 0 ? "PASS" : "FAIL";

  lines.push("");
  lines.push(`${passed} passed, ${failed} failed`);
  lines.push(`OVERALL: ${overall}`);

  return lines.join("\n");
}

export function toReceiptJson(report: VerifyReport): string {
  return JSON.stringify(report, null, 2);
}

export function writeReceipt(report: VerifyReport, cwd: string): string {
  const dir = resolve(cwd, ".verity", "reports");
  mkdirSync(dir, { recursive: true });
  const filename = `${report.timestamp.replace(/:/g, "-")}.json`;
  const path = join(dir, filename);
  writeFileSync(path, toReceiptJson(report));
  return path;
}
