# CCEO Iteration Ledger

## Highest Goal
持续把 CCEO 推进成一个对人类清晰、说明充分、灵活而且强大的 Codex 管理台，并用项目内 `cron-loop` 维持真实推进节奏。

## Active Chains
1. `GUIDE_LAYER_MISSING`
- symptom: 主要页面长期缺少统一的人类说明和下一步指引。
- first_seen: 2026-03-13
- most_recent_seen: 2026-03-13
- status: verified
- attempted_actions:
  - 新增 guide panel、当前上下文卡和动态 next moves。
- evidence:
  - `src/app-support.tsx`
  - `src/App.tsx`
  - `src/styles.css`
  - `.playwright-cli/page-2026-03-12T16-53-27-792Z.yml`
  - `.playwright-cli/page-2026-03-12T16-53-51-327Z.yml`
- next_checkpoint:
  - 继续跟踪新增页面和深层交互是否自动继承说明层。

2. `CHANNEL_REPORT_TOO_RAW`
- symptom: 渠道结果曾直接把整份报告以 JSON 文本暴露在页面上。
- first_seen: 2026-03-13
- most_recent_seen: 2026-03-13
- status: verified
- attempted_actions:
  - 设计结构化渠道报告卡，拆出 summary、issues、warnings、request preview 和 delivery feedback。
- evidence:
  - `src/app-support.tsx`
  - `src/App.tsx`
  - `.playwright-cli/page-2026-03-12T16-55-05-035Z.yml`
- next_checkpoint:
  - 继续减少次级区域的技术噪音，避免其他页面重新出现原始结构化正文。

3. `APP_TSX_MONOLITH`
- symptom: `src/App.tsx` 超过 1500 行，不利于持续迭代。
- first_seen: 2026-03-13
- most_recent_seen: 2026-03-13
- status: verified
- attempted_actions:
  - 抽离前端支撑逻辑和共享组件到 `src/app-support.tsx`。
- evidence:
  - `wc -l src/App.tsx src/app-support.tsx`
  - `src/App.tsx = 1440`
  - `src/app-support.tsx = 721`
- next_checkpoint:
  - 继续保持治理页结构不要回到单文件大泥球。

4. `SELF_ITERATION_LOOP_MISSING`
- symptom: 项目根目录原先没有 `.cron-loop/`，无法稳定持续推进。
- first_seen: 2026-03-13
- most_recent_seen: 2026-03-13
- status: verified
- attempted_actions:
  - 创建 flat singleton `.cron-loop/` 的 `prompt.md`、`runner.sh`、`ledger.md` 和项目管理脚本。
  - 通过 `.cron-loop/manage.mjs start` 装入真实 crontab。
- evidence:
  - `.cron-loop/manage.mjs`
  - `.cron-loop/prompt.md`
  - `.cron-loop/runner.sh`
  - `.cron-loop/state.json`
- next_checkpoint:
  - 观察首次 cron 真实执行是否刷新 `latest.log`、`latest.md` 和 `run.*.log`。

5. `CRON_RUNTIME_ENV_MISSING`
- symptom: cron 启动时无法稳定找到 `codex`、`node`、`npm`、`npx`，导致自管理 runner 在非交互环境下失败。
- first_seen: 2026-03-13
- most_recent_seen: 2026-03-13
- status: verified
- attempted_actions:
  - 在 `~/.codex/skills/cron-loop/scripts/runtime_env.sh` 中补齐共享 PATH 准备逻辑。
  - 让 `runner.sh` 在执行前统一 source 该 helper。
- evidence:
  - `/home/sal/.codex/skills/cron-loop/scripts/runtime_env.sh`
  - `.cron-loop/runner.sh`
  - `.cron-loop/manage.mjs`
- next_checkpoint:
  - 继续验证未来真实 cron 轮次是否稳定写入 `latest.md` 与 `state.json`。

6. `STRICT_AUDIT_STATE_EXPLOSION`
- symptom: 严格前端审计会把导航、胶囊按钮和会话卡片组合成交叉链路，造成深层状态爆炸与 replay 失败。
- first_seen: 2026-03-13
- most_recent_seen: 2026-03-13
- status: investigating
- attempted_actions:
  - 把总览外的侧栏切换改成选择器式工作面切换，切掉导航交叉乘法。
  - 把角色页与项目页的胶囊按钮改成带标签的复选项。
  - 把会话列表改成单选式会话选择器，而不是一串可交叉点击的按钮。
  - 为关键动作与切换入口补齐 `data-testid`。
- evidence:
  - `src/App.tsx`
  - `src/styles.css`
  - `output/frontend-audit/manual-20260313-175036/summary.md`
  - `output/frontend-audit/manual-20260313-175036/findings-fatal.md`
- next_checkpoint:
  - 继续跑严格前端审计，确认 replay failure 是否收敛到可清零范围。

7. `FRONTEND_GUIDANCE_DEPTH`
- symptom: 复杂工作面虽然已有说明层，但还需要把“怎么用”写得更细，避免用户只靠源码和猜测操作。
- first_seen: 2026-03-13
- most_recent_seen: 2026-03-13
- status: fix_in_progress
- attempted_actions:
  - 为主要复杂页补齐 `Workflow / Done Signal` 指引卡。
  - 补齐仓库级功能清单与前端操作手册。
- evidence:
  - `docs/Feature-Inventory.md`
  - `docs/Frontend-Operator-Manual.md`
  - `src/app-support.tsx`
  - `README.md`
- next_checkpoint:
  - 随着前端迭代继续同步更新文档与浏览器内说明层。
