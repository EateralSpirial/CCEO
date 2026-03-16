# Highest Goal
- 持续把 CCEO 推进成一个前端人类可读、说明极其详细、功能灵活而且真正强大的 Codex 管理台。

# Current Scope
- 每一轮都必须围绕“迭代 + debug + 文档完善 + 引导增强”闭环推进。
- 每一轮都必须先完成严格前端审判，再在通过 gate 后执行 Playwright 全盘检查。
- 每一轮都必须更新功能清单和前端复杂功能操作文档，而不是只改代码不补说明。

# Milestones
1. CCEO 的项目内 cron-loop 可以在非交互 cron 环境稳定找到 `codex`、`node`、`npm`、`npx` 并真实执行。
2. 严格前端审计形成固定闭环：strict tribunal -> AI 审判 -> merge verdict -> frontend gate。
3. 只有在 strict gate 通过后，才允许进入 Playwright 全盘检查。
4. 功能清单和前端操作手册持续更新，覆盖已实现、部分实现、待实现边界。
5. 前端中每一个较为复杂的功能都拥有细致、完整、面向人的使用引导。

# Progress Evidence
- `.plans/Frontend-Iteration.md`、`.plans/term_2/Plan_2.md`、`.plans/term_2/Test_2.md` 有新的问题链推进、验证记录和剩余边界。
- `docs/Feature-Inventory.md` 与 `docs/Frontend-Operator-Manual.md` 有本轮更新。
- `output/frontend-audit/**` 中出现新的 tribunal 报告、`judgment-brief.md`、`gate-summary.json`。
- `output/playwright/**` 中出现新的全盘检查截图和 `report.json`。
- `.cron-loop/issues.registry.json`、`.cron-loop/issues.events.jsonl`、`.cron-loop/latest.md` 有新的状态与结论。

# Files To Read And Update
本轮开始前先读取：
1. `.plans/Intent-Vision.md`
2. `.plans/Requirements.md`
3. `.plans/Modules-Functions.md`
4. `.plans/term_2/Plan_2.md`
5. `.plans/term_2/Test_2.md`
6. `.plans/Frontend-Iteration.md`
7. `docs/Feature-Inventory.md`（若不存在则创建）
8. `docs/Frontend-Operator-Manual.md`（若不存在则创建）
9. `README.md`
10. `src/App.tsx`
11. `src/app-support.tsx`
12. `src/styles.css`
13. `src/api.ts`
14. `server/**/*.ts`
15. `scripts/review_server.sh`
16. `scripts/run_strict_frontend_tribunal.sh`
17. `scripts/check_frontend_gate.mjs`
18. `scripts/playwright_full_sweep.mjs`
19. `.cron-loop/state.json`
20. `.cron-loop/issues.registry.json`
21. `.cron-loop/issues.summary.md`
22. `.cron-loop/latest.md`
23. `.cron-loop/ledger.md`

读取边界：
1. `.cron-loop/issues.registry.json` 是问题系统真源；`.cron-loop/issues.summary.md` 是人类摘要视图；`.cron-loop/issues.events.jsonl` 只在需要追溯具体转换时读取。
2. `.cron-loop/latest.log` 和 `run.*.log` 是审计文件，不是默认记忆层。
3. 只有上一轮失败、`latest.md` 指向具体 run log、或本轮需要一个精确法证细节时，才打开某一个具体 `run.*.log`。
4. 不要把 `.cron-loop/*.log`、`.cron-loop/*.md`、`.cron-loop/*.json` 整体批量回读、tail-loop 或做常规 diff。

# Execution Norms
1. 进入本轮后，先使用 `using-superpowers`，然后按需使用 `strict-frontend-auditor`、`playwright`、`cron-loop`。
2. 先根据当前证据判断本轮最值得推进的问题链，不允许机械重复上轮动作。
3. 先执行 `npm run build`，再用 `scripts/review_server.sh start --port "$CCEO_REVIEW_PORT"` 启动本轮审计专用 review server。
4. 运行 strict tribunal：
   - `scripts/run_strict_frontend_tribunal.sh --url "$CCEO_REVIEW_URL" --out "<本轮 frontend-audit 输出目录>"`
   - 阅读生成的 `judgment-brief.md`
   - 使用 `strict-frontend-auditor` 的 AI phase 和 `ai_inspect.mjs` 完成语义审判
   - 写入 `ai-findings.json`
   - 执行 `merge_verdict.mjs`
   - 执行 `node scripts/check_frontend_gate.mjs --report-dir "<报告目录>"`
5. 若 strict gate 未通过，优先修复 FATAL / ERROR，再重复 strict tribunal，直到 gate 通过或本轮时间预算耗尽。
6. 只有 strict gate 通过后，才允许执行 Playwright 全盘检查：
   - `node scripts/playwright_full_sweep.mjs --url "$CCEO_REVIEW_URL" --out "<本轮 playwright 输出目录>"`
   - 若 Playwright 报告失败，继续修复并复跑，直到通过或时间预算耗尽。
7. 每轮都必须继续完善：
   - `docs/Feature-Inventory.md` 的详细功能清单
   - `docs/Frontend-Operator-Manual.md` 的复杂功能操作说明
   - 前端页面中复杂功能的引导文字、步骤说明、判定标准、异常提示
8. 优先减少用户必须自己理解的技术负担：原始 JSON、内部字段、长路径、ISO 时间、无说明输入、无判定标准的按钮。
9. 若本轮修改影响 cron-loop、本地脚本或审计链路，额外执行：
   - `node .cron-loop/manage.mjs validate`
   - `node .cron-loop/manage.mjs list`
10. 每轮都要通过 `.cron-loop/issues.registry.json`、`.cron-loop/issues.events.jsonl`、`.cron-loop/issues.summary.md` 推进长期问题，而不是只在 `ledger.md` 里追加自由文本。
11. 结束前，停止本轮启动的 review server，避免残留进程。

# Output Requirement
- 结束时在 `.cron-loop/latest.md` 留下简短结果，至少包含：
  - 本轮修复了什么
  - strict tribunal 是否通过，报告目录是什么
  - Playwright 全盘检查是否通过，输出目录是什么
  - 文档和引导更新了哪些内容
  - 下一轮最该盯什么
