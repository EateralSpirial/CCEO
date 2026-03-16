import fs from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const args = { reportDir: "", failOnWarning: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--report-dir") {
      args.reportDir = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--fail-on-warning") {
      args.failOnWarning = true;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  if (!args.reportDir) {
    throw new Error("--report-dir is required");
  }
  return args;
}

function countBySeverity(findings) {
  const summary = { FATAL: 0, ERROR: 0, WARNING: 0, INFO: 0 };
  for (const finding of findings) {
    const level = String(finding?.severity ?? "").toUpperCase();
    if (level in summary) {
      summary[level] += 1;
    }
  }
  return summary;
}

function hasCoverageGap(coverage) {
  return [
    coverage.skippedByPerStateLimit,
    coverage.skippedByTotalLimit,
    coverage.riskySkipped,
    coverage.chainDepthSkipped,
    coverage.unresolvedReplayFailures,
  ].some((value) => Number(value || 0) > 0);
}

const args = parseArgs(process.argv.slice(2));
const reportDir = path.resolve(args.reportDir);
const findingsPath = path.join(reportDir, "findings.json");
const coveragePath = path.join(reportDir, "coverage.json");
const gateSummaryPath = path.join(reportDir, "gate-summary.json");
const gateSummaryMdPath = path.join(reportDir, "gate-summary.md");

const [findingsRaw, coverageRaw] = await Promise.all([
  fs.readFile(findingsPath, "utf8"),
  fs.readFile(coveragePath, "utf8"),
]);

const findings = JSON.parse(findingsRaw);
const coverage = JSON.parse(coverageRaw);
const severity = countBySeverity(Array.isArray(findings) ? findings : []);
const coverageGap = hasCoverageGap(coverage);
const pass =
  severity.FATAL === 0 &&
  severity.ERROR === 0 &&
  !coverageGap &&
  (!args.failOnWarning || severity.WARNING === 0);

const summary = {
  reportDir,
  pass,
  failOnWarning: args.failOnWarning,
  severity,
  coverageGap,
  checkedAt: new Date().toISOString(),
};

const md = [
  "# Frontend Gate Summary",
  "",
  `- Report Dir: ${reportDir}`,
  `- Checked At: ${summary.checkedAt}`,
  `- Pass: ${pass ? "yes" : "no"}`,
  `- Coverage Gap: ${coverageGap ? "yes" : "no"}`,
  `- FATAL: ${severity.FATAL}`,
  `- ERROR: ${severity.ERROR}`,
  `- WARNING: ${severity.WARNING}`,
  `- INFO: ${severity.INFO}`,
  "",
  "## Gate Rule",
  "",
  args.failOnWarning
    ? "- 通过条件：FATAL=0、ERROR=0、WARNING=0、coverage gap=0。"
    : "- 通过条件：FATAL=0、ERROR=0、coverage gap=0；WARNING 允许暂存但必须继续压缩。",
  "",
].join("\n");

await Promise.all([
  fs.writeFile(gateSummaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8"),
  fs.writeFile(gateSummaryMdPath, `${md}\n`, "utf8"),
]);

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
process.exit(pass ? 0 : 2);
