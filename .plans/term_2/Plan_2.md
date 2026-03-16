# Plan 2

## 本期目标
在 MVP 基础上补齐外部渠道和知识库自动化能力，让总经理从“本地控制台”进化为“跨渠道运营面”。

## 本期范围
- Slack / Telegram 真实渠道桥接与路由。
- 渠道到项目/角色/总经理的映射。
- 知识库同步任务、collection 生命周期操作。
- 项目级自动化任务编排入口。

## 前置依赖与准备项
- term_1 已交付统一数据模型和 Codex 运行桥。
- 已存在至少一个可管理项目。

## 详细任务列表（按顺序）
1. 实现 Slack / Telegram 驱动适配器、凭证校验和 dry-run 验证。
2. 建立渠道消息路由规则与项目绑定。
3. 实现知识库同步任务定义与运行记录。
4. 把知识库同步任务接入 `cron-loop` 管理面。
5. 允许总经理从渠道配置中选择发言身份和风格，并处理渠道回流。

## 交付物清单
- Slack / Telegram 真实桥接能力。
- 渠道-项目-角色路由模型。
- 知识库同步任务与运行状态。

## 验收标准
- 渠道凭证可校验，dry-run 与最小真实投递可验证。
- 知识库同步任务可创建并记录运行历史。
- 管理台中能看到渠道和自动化的项目归属。

## 风险与回滚策略
- 若真实渠道凭证不可用，则保留 dry-run 与配置校验模式。
- 若知识库同步链路过长，则先保证任务定义和执行记录可追溯。

## 与后续期衔接
- 为 term_3 的权限审计和多项目策略打基础。

## 执行状态（2026-03-11）
- 状态：进行中。
- 本轮已完成：
  - Slack / Telegram 渠道连接配置模型扩展，新增 `config` 与 `runtime` 持久化结构。
  - `channel-connector` 后端桥接模块，支持配置校验、dry-run 请求预览、最小真实发送测试。
  - 渠道运行态回写：最近一次校验、投递模式、投递结果、错误摘要会进入 registry。
  - 前端渠道工作台支持：
    - 条件化编辑 Slack / Telegram 参数
    - 校验配置
    - dry-run 测试
    - 真实发送测试
    - 查看最近一次运行态与结构化报告
  - 项目编辑器补齐 `channelBindings` 入口，可保存每个渠道的 `room` 与 `alias`。
  - 新增 Slack socket mode 原生接入：
    - 渠道模型补齐 `slackMode / slackBotToken / slackAppToken / slackSigningSecret / slackWebhookPath / slackRequireMention / slackDefaultProjectId`
    - 后端新增 Slack 连接管理、`connect / disconnect` API 和启动时自动同步
    - Slack 消息可路由到项目总经理线程，并沿用既有 `codex exec` / `exec resume` 运行桥
    - 运行结果可回传到 Slack，对应运行态会记录连接状态、最近回流、路由项目与线程
  - 前端渠道页升级为可操作的 Slack 接入工作台：
    - socket / webhook / http 模式切换
    - 默认项目与默认 target 配置
    - Slack 接入步骤说明与 manifest 片段
    - `Connect Slack` / `Disconnect Slack` 控制按钮
    - 连接态、最近回流和路由状态展示
- 本轮验证结果：
  - 无凭证校验链路已验证。
  - 本地 mock Slack / Telegram 真实发送链路已验证。
  - `npm run build` 通过，确认后端 Slack 连接管理与前端新字段都已通过类型检查和打包。
  - 启动 `npm run start` 后，`GET /api/bootstrap` 能返回新增 Slack 配置字段与连接运行态。
  - `POST /api/channels/channel-slack-primary/connect` / `disconnect` 在 webhook 模式下能返回明确连接报告，而不是静默失败。
  - Playwright 已验证渠道页可看到 Slack 模式切换、默认项目、token 字段、接入说明、Connect/Disconnect 按钮与运行态卡片。
- 剩余重点：
  - 知识库同步任务与 `cron-loop` 接入。
  - Telegram 真实回流桥接。
  - Slack 真实 token 场景下的端到端联调与更细的频道访问策略。

## 增量执行状态（2026-03-13）
- 状态：进行中；term_2 已从“渠道桥接”继续推进到“操作者可读性 + 自迭代回路”。
- 本轮已完成：
  - 新增 `operator-guidance-layer` 的实际前端落地：
    - 主要标签页统一出现 `Operator Guide / Current Context / Next Moves` 三层说明卡。
    - 空态与下一步建议改为面向操作者的文本，而不是只暴露技术字段。
  - 渠道页继续增强为人类可读工作台：
    - 渠道动作结果从原始 JSON 转成结构化报告卡，拆分 summary、issues、warnings、request preview、delivery feedback。
    - Slack / Telegram 均补齐 `Setup Guide`、保存前检查表、完成后的判定提示。
    - Slack manifest 降为证据层，主界面改为 manifest 摘要与模式化引导。
  - Cron 页继续增强：
    - 新增 `动作解读` 面板，对 `validate / pause / resume / paths` 的结果给出解释性结论、关键字段和原始证据。
    - 空态改为 Quickstart 卡，明确 flat `.cron-loop/` 任务应具备的文件与能力。
  - 前端结构治理继续推进：
    - 抽离 `src/app-support.tsx`，集中承载 guide、channel report、cron interpretation 等支撑逻辑。
    - `src/App.tsx` 相比最初的 1559 行已大幅收敛；当前保持在 1440 行，仍控制在单文件阈值内，避免 term_2 再滑回单文件堆砌。
  - CCEO 自身的项目内持续迭代回路已经落地：
    - 新建 `.cron-loop/manage.py`、`cceo-iteration.prompt.md`、`cceo-iteration.runner.sh`、`ledger/latest` 等文件。
    - `cceo-iteration` 已安装到真实 crontab，schedule 为 `17 */4 * * *`。
  - 复杂工作面继续增强：
    - 侧栏导航改为审计可重放的稳定结构，并补充更明确的导航说明文案。
    - 总经理、角色、项目、Cron、渠道等页新增更细的浏览器内工作流说明卡。
    - 仓库级文档补齐 `docs/Feature-Inventory.md` 与 `docs/Frontend-Operator-Manual.md`。
- 本轮验证结果：
  - `npm run build` 通过。
  - `python3 .cron-loop/manage.py validate` 返回 `validation=ok`、`active=1`、`paused=0`。
  - `python3 .cron-loop/manage.py list` 显示 `cceo-iteration` 已处于 active。
  - `GET /api/bootstrap` 已能返回该 cron job，并在浏览器里显示为当前项目的可管理任务。
  - Playwright 已验证：
    - Cron 页可见动作解读卡与结构化 key/value 结果。
    - 渠道页可见 Telegram setup guide。
    - Slack 渠道可见基于当前模式的 setup guide、保存前检查表和 manifest 摘要。
  - 严格前端审计已被纳入自管理闭环，当前待继续清零导航重放类 FATAL。
- 新的剩余重点：
  - 知识库同步任务、Qdrant collection 生命周期治理与 `cron-loop` 接入。
  - Telegram 真实消息回流桥接，而不只是发送测试。
  - Slack 在真实 token / 真实频道环境中的端到端联调。
  - 继续收缩页面中的技术噪音，避免新功能把前端重新拉回“参数墙”。
