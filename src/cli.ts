#!/usr/bin/env node
import process from "node:process";
import { formatHuman, toReceiptJson, writeReceipt } from "./report.ts";
import { VerityUsageError } from "./types.ts";
import { DEFAULT_MANIFEST_PATH, getToolVersion, verify } from "./verify.ts";

const USAGE = `verity — deterministic claim verifier

Usage:
  verity verify [manifestPath] [--json]
  verity --version | -v
  verity --help | -h

Arguments:
  manifestPath   Path to claims manifest (default: ${DEFAULT_MANIFEST_PATH})

Options:
  --json         Print the full JSON report to stdout instead of the human summary`;

function runVerifyCommand(args: string[]): number {
  let manifestPath = DEFAULT_MANIFEST_PATH;
  let json = false;

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
    } else if (arg.startsWith("-")) {
      process.stderr.write(`unknown option: ${arg}\n`);
      return 2;
    } else {
      manifestPath = arg;
    }
  }

  let outcome;
  try {
    outcome = verify(manifestPath);
  } catch (err) {
    if (err instanceof VerityUsageError) {
      process.stderr.write(`${err.message}\n`);
      return 2;
    }
    throw err;
  }

  writeReceipt(outcome.report, process.cwd());

  process.stdout.write(`${json ? toReceiptJson(outcome.report) : formatHuman(outcome.report)}\n`);

  return outcome.exitCode;
}

export function main(argv: string[]): number {
  const [cmd, ...rest] = argv;

  if (cmd === "--version" || cmd === "-v") {
    process.stdout.write(`${getToolVersion()}\n`);
    return 0;
  }

  if (cmd === "--help" || cmd === "-h") {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  if (cmd === undefined) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }

  if (cmd === "verify") {
    return runVerifyCommand(rest);
  }

  process.stderr.write(`unknown command: ${cmd}\n${USAGE}\n`);
  return 2;
}

process.exitCode = main(process.argv.slice(2));
