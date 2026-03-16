# Issues Summary

- updated_at_utc: `2026-03-15T18:51:11.985000+00:00`
- active_issue_count: `6`
- closed_issue_count: `1`

## Active Issues
### STRICT_AUDIT_STATE_EXPLOSION: 严格前端审计在复杂导航与选择器组合下出现状态爆炸
- status: `investigating`
- severity: `high`
- chain_location: `src/App.tsx`
- first_seen_at_utc: `2026-03-13`
- most_recent_seen_at_utc: `2026-03-13`
- recurrence_count: `0`
- verification_rounds_clean: `0`
- summary: 严格前端审计会把导航、胶囊按钮和会话卡片组合成交叉链路，造成深层状态爆炸与 replay 失败。
- attempted_actions:
  - 把总览外的侧栏切换改成选择器式工作面切换，切掉导航交叉乘法。
  - 把角色页与项目页的胶囊按钮改成带标签的复选项。
  - 把会话列表改成单选式会话选择器，而不是一串可交叉点击的按钮。
  - 为关键动作与切换入口补齐 `data-testid`。
- next_checkpoint: 继续跑严格前端审计，确认 replay failure 是否收敛到可清零范围。

### FRONTEND_GUIDANCE_DEPTH: 复杂工作面的操作说明深度仍然不足
- status: `fix_in_progress`
- severity: `medium`
- chain_location: `docs/Frontend-Operator-Manual.md`
- first_seen_at_utc: `2026-03-13`
- most_recent_seen_at_utc: `2026-03-13`
- recurrence_count: `0`
- verification_rounds_clean: `0`
- summary: 复杂工作面虽然已有说明层，但还需要把“怎么用”写得更细，避免用户只靠源码和猜测操作。
- attempted_actions:
  - 为主要复杂页补齐 `Workflow / Done Signal` 指引卡。
  - 补齐仓库级功能清单与前端操作手册。
- next_checkpoint: 随着前端迭代继续同步更新文档与浏览器内说明层。

### APP_TSX_MONOLITH: src/App.tsx 体量过大，不利于持续迭代
- status: `verified`
- severity: `low`
- chain_location: `src/App.tsx`
- first_seen_at_utc: `2026-03-13`
- most_recent_seen_at_utc: `2026-03-13`
- recurrence_count: `0`
- verification_rounds_clean: `1`
- summary: `src/App.tsx` 曾超过 1500 行，不利于持续迭代。
- attempted_actions:
  - 抽离前端支撑逻辑和共享组件到 `src/app-support.tsx`。
- next_checkpoint: 继续保持治理页结构不要回到单文件大泥球。

### CHANNEL_REPORT_TOO_RAW: 渠道结果直接暴露原始 JSON 报告
- status: `verified`
- severity: `medium`
- chain_location: `src/App.tsx`
- first_seen_at_utc: `2026-03-13`
- most_recent_seen_at_utc: `2026-03-13`
- recurrence_count: `0`
- verification_rounds_clean: `1`
- summary: 渠道结果曾直接把整份报告以 JSON 文本暴露在页面上。
- attempted_actions:
  - 设计结构化渠道报告卡，拆出 summary、issues、warnings、request preview 和 delivery feedback。
- next_checkpoint: 继续减少次级区域的技术噪音，避免其他页面重新出现原始结构化正文。

### GUIDE_LAYER_MISSING: 主要页面缺少统一的人类说明和下一步指引
- status: `verified`
- severity: `medium`
- chain_location: `src/app-support.tsx`
- first_seen_at_utc: `2026-03-13`
- most_recent_seen_at_utc: `2026-03-13`
- recurrence_count: `0`
- verification_rounds_clean: `1`
- summary: 主要页面长期缺少统一的人类说明和下一步指引。
- attempted_actions:
  - 新增 guide panel、当前上下文卡和动态 next moves。
- next_checkpoint: 继续跟踪新增页面和深层交互是否自动继承说明层。

### CRON_RUNTIME_ENV_MISSING: cron 非交互环境无法稳定找到 codex/node/npm/npx
- status: `verified`
- severity: `high`
- chain_location: `/home/sal/.codex/skills/cron-loop/scripts/runtime_env.sh`
- first_seen_at_utc: `2026-03-13`
- most_recent_seen_at_utc: `2026-03-16`
- recurrence_count: `0`
- verification_rounds_clean: `1`
- summary: cron 启动时无法稳定找到 `codex`、`node`、`npm`、`npx`，导致自管理 runner 在非交互环境下失败。
- attempted_actions:
  - 在 `runtime_env.sh` 中补齐共享 PATH 准备逻辑。
  - 让 Node 版 `runner.sh` 在执行前统一 source 该 helper。
- verification_conclusion: 2026-03-16 Node 版 runner 已统一 source runtime_env.sh，并固定通过 node 启动 manage_cron.mjs / capture_exec.mjs。
- next_checkpoint: 继续验证未来真实 cron 轮次是否稳定写入 `latest.md` 与 `state.json`。

## Closed Issues
### SELF_ITERATION_LOOP_MISSING: 项目根目录缺少可持续推进的 singleton cron-loop
- status: `closed`
- closed_at_utc: `2026-03-15T18:51:11.799000+00:00`
- summary: 项目根目录原先没有 `.cron-loop/`，无法稳定持续推进。
- verification_conclusion: 2026-03-16 已迁移到 Node 版 singleton cron-loop，旧 prefixed runner 与 Python 管理入口不再存在。
