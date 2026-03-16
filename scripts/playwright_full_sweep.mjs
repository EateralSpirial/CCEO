import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

function parseArgs(argv) {
  const args = { url: "http://127.0.0.1:3197", outDir: "", headed: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--url") {
      args.url = argv[index + 1] ?? args.url;
      index += 1;
      continue;
    }
    if (token === "--out") {
      args.outDir = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--headed") {
      args.headed = true;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  if (!args.outDir) {
    args.outDir = path.resolve(process.cwd(), "output", "playwright", `full-sweep-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  }
  return args;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

const args = parseArgs(process.argv.slice(2));
const codexHome = process.env.CODEX_HOME?.trim() || path.join(os.homedir(), ".codex");
const playwrightModulePath = path.join(codexHome, "skills", "strict-frontend-auditor", "node_modules", "playwright", "index.js");
if (!(await fileExists(playwrightModulePath))) {
  throw new Error(`Playwright package not found: ${playwrightModulePath}`);
}

const playwrightModule = await import(pathToFileURL(playwrightModulePath).href);
const { chromium } = playwrightModule.default ?? playwrightModule;
const outDir = path.resolve(args.outDir);
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: !args.headed });
const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
const page = await context.newPage();

const consoleErrors = [];
const pageErrors = [];
const requestFailures = [];
const responseErrors = [];

page.on("console", (message) => {
  if (message.type() === "error") {
    consoleErrors.push(message.text());
  }
});
page.on("pageerror", (error) => {
  pageErrors.push(String(error));
});
page.on("requestfailed", (request) => {
  requestFailures.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || "unknown"}`);
});
page.on("response", (response) => {
  if (response.status() >= 400) {
    responseErrors.push(`${response.status()} ${response.url()}`);
  }
});

const steps = [];

async function captureStep(label, buttonName, requiredText) {
  if (buttonName) {
    await page.getByRole("button", { name: buttonName }).click();
  }
  await page.getByText(requiredText, { exact: false }).waitFor({ timeout: 10000 });
  await page.getByText("Operator Guide", { exact: false }).waitFor({ timeout: 10000 });
  await page.getByText("Current Context", { exact: false }).waitFor({ timeout: 10000 });
  await page.getByText("Next Moves", { exact: false }).waitFor({ timeout: 10000 });
  const screenshotPath = path.join(outDir, `${steps.length.toString().padStart(2, "0")}-${label}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  steps.push({ label, buttonName, requiredText, screenshotPath });
}

await page.goto(args.url, { waitUntil: "networkidle" });
await page.getByText("Codex Executive Officer", { exact: false }).waitFor({ timeout: 10000 });

await captureStep("dashboard", "", "系统概况");
await captureStep("manager", "总经理", "总经理主线程");
await captureStep("personas", "角色", "角色清单");
await captureStep("sessions", "会话", "会话与记忆索引");
await captureStep("knowledge", "知识库", "知识库列表");
await captureStep("projects", "项目", "项目清单");
await captureStep("cron", "Cron", "cron-loop 任务");
await page.getByRole("button", { name: "validate" }).click();
await page.getByText("动作解读", { exact: false }).waitFor({ timeout: 10000 });
{
  const screenshotPath = path.join(outDir, "07-cron-after-validate.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  steps.push({ label: "cron-after-validate", buttonName: "validate", requiredText: "动作解读", screenshotPath });
}

await captureStep("channels", "渠道", "渠道清单");
await page.getByRole("button", { name: /Slack Bridge/i }).click();
await page.getByText("Socket Manifest 摘要", { exact: false }).waitFor({ timeout: 10000 });
{
  const screenshotPath = path.join(outDir, "08-channels-slack.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  steps.push({ label: "channels-slack", buttonName: "Slack Bridge", requiredText: "Socket Manifest 摘要", screenshotPath });
}

await page.getByRole("button", { name: /Telegram Bridge/i }).click();
await page.getByText("完成后的判定方法", { exact: false }).waitFor({ timeout: 10000 });
{
  const screenshotPath = path.join(outDir, "09-channels-telegram.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  steps.push({ label: "channels-telegram", buttonName: "Telegram Bridge", requiredText: "完成后的判定方法", screenshotPath });
}

const report = {
  checkedAt: new Date().toISOString(),
  url: args.url,
  outDir,
  steps,
  consoleErrors,
  pageErrors,
  requestFailures,
  responseErrors,
  pass: consoleErrors.length === 0 && pageErrors.length === 0 && requestFailures.length === 0 && responseErrors.length === 0,
};

await fs.writeFile(path.join(outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
await browser.close();

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exit(report.pass ? 0 : 2);
