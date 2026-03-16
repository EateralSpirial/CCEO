#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_MANAGE = "/home/sal/.codex/skills/cron-loop/scripts/manage_cron.mjs";
const DEFAULT_SCHEDULE = "17 */4 * * *";

function usage(message) {
  const lines = [
    "usage: manage.mjs <action> [options]",
    "",
    "actions:",
    "  paths render init start stop destroy list validate gc",
    "  issue-create issue-update issue-event issue-render",
  ];
  if (message) {
    lines.push("", `error: ${message}`);
  }
  return lines.join("\n");
}

function parseArgs(argv) {
  if (!argv.length || argv[0] === "-h" || argv[0] === "--help") {
    console.log(usage());
    process.exit(0);
  }
  const options = {
    action: argv[0],
    evidenceRef: [],
    attemptedAction: [],
    force: false,
    bumpRecurrence: false,
  };
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`unexpected argument: ${token}`);
    }
    if (token === "--force") {
      options.force = true;
      continue;
    }
    if (token === "--bump-recurrence") {
      options.bumpRecurrence = true;
      continue;
    }
    const value = argv[index + 1];
    if (value == null) {
      throw new Error(`missing value for ${token}`);
    }
    index += 1;
    const key = token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (key === "evidenceRef") {
      options.evidenceRef.push(value);
      continue;
    }
    if (key === "attemptedAction") {
      options.attemptedAction.push(value);
      continue;
    }
    options[key] = value;
  }
  return options;
}

function buildCommand(options) {
  const command = [
    process.execPath,
    SKILL_MANAGE,
    options.action,
    "--project-root",
    ROOT_DIR,
  ];
  if (["render", "init", "start"].includes(options.action)) {
    command.push("--cron", String(options.cron ?? DEFAULT_SCHEDULE));
  }
  if (options.force) {
    command.push("--force");
  }
  const passthrough = {
    "--issue-id": options.issueId,
    "--title": options.title,
    "--scope": options.scope,
    "--severity": options.severity,
    "--status": options.status,
    "--chain-location": options.chainLocation,
    "--normalized-symptom": options.normalizedSymptom,
    "--summary": options.summary,
    "--current-hypothesis": options.currentHypothesis,
    "--next-checkpoint": options.nextCheckpoint,
    "--owner": options.owner,
    "--tags": options.tags,
    "--parent-issue-id": options.parentIssueId,
    "--first-seen-at-utc": options.firstSeenAtUtc,
    "--most-recent-seen-at-utc": options.mostRecentSeenAtUtc,
    "--event-summary": options.eventSummary,
    "--event-type": options.eventType,
    "--to-status": options.toStatus,
    "--round-id": options.roundId,
    "--bump-clean-rounds": options.bumpCleanRounds,
    "--verification-conclusion": options.verificationConclusion,
  };
  for (const [flag, value] of Object.entries(passthrough)) {
    if (value != null) {
      command.push(flag, String(value));
    }
  }
  for (const value of options.evidenceRef) {
    command.push("--evidence-ref", String(value));
  }
  for (const value of options.attemptedAction) {
    command.push("--attempted-action", String(value));
  }
  if (options.bumpRecurrence) {
    command.push("--bump-recurrence");
  }
  return command;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const command = buildCommand(options);
  const completed = spawnSync(command[0], command.slice(1), { stdio: "inherit" });
  if (completed.error) {
    throw completed.error;
  }
  process.exitCode = completed.status ?? 1;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(usage(message));
  process.exitCode = 2;
}
