# Frontend Iteration

## 当前最高目标
把 CCEO 打造成一个对人类清晰、说明充分、操作灵活且真正强大的 Codex 管理台，而不是继续堆积工程参数和原始结构化数据。

## 本轮重点
1. 修复导航在严格前端审计中的状态重放失败，确保侧栏切换可重复审计。
2. 把复杂工作面的浏览器内工作流说明补细，让用户在页面里就能知道步骤、完成判定和常见闭环。
3. 把功能清单与操作手册文档正式补齐，并纳入每轮迭代同步更新。

## 设计准则
1. 能解释的页面必须解释，不把意图藏在字段名里。
2. 能选择的地方尽量让用户选，不让用户记内部细节。
3. 原始 JSON、长 ID、技术细节只能做辅助证据，不能做主界面主体。
4. 前端增强要和结构治理一起做，不能只加文案不改组织方式。

## 问题链
1. `GUIDE_LAYER_MISSING`
- 症状：主要页面缺少统一的人类说明、上下文提醒和下一步建议。
- 首次发现：2026-03-13
- 最近发现：2026-03-13
- 当前状态：verified
- 已尝试动作：
  - 新增全局 guide panel、上下文说明卡和动态 next moves。
- 证据与验证：
  - `npm run build` 通过。
  - Playwright 快照显示总览、Cron、渠道页都出现了说明层和上下文卡。
- 下次检查点：
  - 继续确保新增页面和深层交互不会绕过说明层。

2. `CHANNEL_REPORT_TOO_RAW`
- 症状：渠道页把整份结构化报告直接 JSON.stringify 给用户，阅读负担过高。
- 首次发现：2026-03-13
- 最近发现：2026-03-13
- 当前状态：verified
- 已尝试动作：
  - 改为结构化报告卡，拆分 summary、issues、warnings、request preview、delivery feedback。
- 证据与验证：
  - `npm run build` 通过。
  - Playwright 在 Slack 渠道执行“校验配置”后，页面显示结构化结果卡，不再把整份 JSON 作为正文。
- 下次检查点：
  - 继续压缩不必要的技术细节，避免把 JSON 变成主界面正文。

3. `APP_TSX_MONOLITH`
- 症状：`src/App.tsx` 超过 1500 行，继续演进时容易滑回单文件堆砌。
- 首次发现：2026-03-13
- 最近发现：2026-03-13
- 当前状态：verified
- 已尝试动作：
  - 抽离前端支撑函数、引导组件与静态说明配置。
- 证据与验证：
  - `wc -l src/App.tsx src/app-support.tsx` 显示 `src/App.tsx = 1440` 行，`src/app-support.tsx = 721` 行。
  - `npm run build` 通过。
- 下次检查点：
  - 继续把高噪声逻辑拆出，优先保持治理页可维护。

4. `SELF_ITERATION_LOOP_MISSING`
- 症状：项目本身没有 `.cron-loop/`，无法稳定持续推进。
- 首次发现：2026-03-13
- 最近发现：2026-03-13
- 当前状态：verified
- 已尝试动作：
  - 创建并安装 `cceo-iteration` job，补齐 prompt、runner、ledger、latest 和项目管理脚本。
- 证据与验证：
  - `python3 .cron-loop/manage.py install` 已把任务装入 crontab。
  - `python3 .cron-loop/manage.py validate` 返回 `validation=ok`。
  - `GET /api/bootstrap` 与 Playwright Cron 页都能识别该任务。
- 下次检查点：
  - 观察首轮定时执行是否写入新的 `latest.log / latest.md / run.*.log`。

5. `NAV_AUDIT_REPLAY_UNSTABLE`
- 症状：严格前端审计在重放侧栏导航动作时出现 `selector not found`，导致 coverage gap 被判为 FATAL。
- 首次发现：2026-03-13
- 最近发现：2026-03-13
- 当前状态：fix_in_progress
- 已尝试动作：
  - 把侧栏导航改为稳定按钮结构，并补充 `data-testid` 与更清晰的标签/说明。
- 证据与验证：
  - `output/frontend-audit/manual-20260313-170308/findings-fatal.md`
- 下次检查点：
  - 重跑严格前端审计，确认 `unresolvedReplayFailures = 0`。
