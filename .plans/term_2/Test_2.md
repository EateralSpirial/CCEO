# Test 2

## 测试范围
- `channel-connector` 后端桥接模块
- 渠道配置持久化与运行状态回写
- 渠道校验与测试投递 API
- Slack socket 连接管理与消息路由准备
- 渠道页前端配置、dry-run 和结果展示
- `operator-guidance-layer` 的页面说明、空态和下一步建议
- `cron-loop-governor` 的 CCEO 自迭代任务识别与结构化动作反馈
- `src/app-support.tsx` 抽离后的前端支撑层可维护性

## 测试用例列表
1. 正常流程：保存 Slack 渠道配置后，`GET /api/bootstrap` 返回完整 `config` 和 `runtime` 字段。
2. 正常流程：对未配置凭证的渠道执行 `validate`，返回明确 `issues`、`liveReady=false`，服务不崩溃。
3. 正常流程：对 Slack 渠道执行 `dry-run` 测试，返回请求预览、`mode=dry-run`、`delivered=false`。
4. 正常流程：对 Telegram 渠道执行 `dry-run` 测试，返回请求预览、`mode=dry-run`、`delivered=false`。
5. 正常流程：前端渠道页能切换 Slack / Telegram 配置项并保存。
6. 异常流程：真实发送测试在缺少必要凭证时返回 400 或 422 级别错误，而不是静默成功。
7. 异常流程：Slack webhook 返回非 2xx 时，API 返回失败报告并把错误写入渠道 `runtime`。
8. 异常流程：Telegram API 返回 `ok=false` 时，API 返回失败报告并把错误写入渠道 `runtime`。
9. 正常流程：`GET /api/bootstrap` 返回 Slack 新增字段 `slackMode / slackBotToken / slackAppToken / slackSigningSecret / slackWebhookPath / slackRequireMention / slackDefaultProjectId`。
10. 正常流程：`POST /api/channels/:id/connect` 与 `disconnect` 返回结构化连接报告，并把 `connectionState / lastConnectionSummary` 写回 `runtime`。
11. 正常流程：渠道页切到 Slack 后能看到模式切换、默认项目、接入说明、Connect/Disconnect 按钮和最近回流状态。
12. 异常流程：Slack 频道处于非 socket 模式时执行 `connect`，API 返回“无需常驻 socket”的明确报告，而不是服务异常。
13. 正常流程：总览、Cron、渠道等主要页面都出现 `Operator Guide / Current Context / Next Moves` 说明层。
14. 正常流程：Cron 页在未执行动作时显示“动作解读”占位卡；执行 `validate` 后显示结构化结论、关键字段和原始输出入口。
15. 正常流程：渠道页选择 Telegram 时，出现 `Setup Guide`、保存前检查表和完成后的判定方法。
16. 正常流程：渠道页选择 Slack 时，出现与当前模式匹配的 `Setup Guide`、保存前检查表和 Socket Manifest 摘要。
17. 正常流程：`src/App.tsx` 的高噪声支撑逻辑被拆到 `src/app-support.tsx` 后，项目仍能通过构建并正常加载页面。
18. 正常流程：`cceo-iteration` 项目内 `cron-loop` 任务可被 bootstrap 与浏览器识别，状态显示为 active。
19. 正常流程：严格前端审计在侧栏导航切换后能够成功重放状态链，不再出现 `selector not found`。
20. 正常流程：总经理、角色、项目、Cron、渠道等复杂页在浏览器中可见更细的工作流说明卡。
21. 正常流程：`docs/Feature-Inventory.md` 与 `docs/Frontend-Operator-Manual.md` 与当前界面能力保持一致。

## 通过标准
- `npm run build` 通过。
- 渠道配置保存、校验、dry-run 三条链路都可实际调用。
- 最近一次校验与投递结果能在 registry 中持久化，并在前端可见。
- 至少完成一条 dry-run smoke，用于证明 term_2 的渠道桥已经不是占位模型。
- 主要工作面不再以原始 JSON、长技术字段或空白页为主界面主体。
- `cron-loop` 自迭代任务必须具备可识别状态、结构校验结果和浏览器可见的管理入口。

## 实际执行记录（2026-03-10）
1. 构建验证
- `npm run build:server`：通过。
- `npm run build:web`：通过。
- `npm run build`：通过。

2. 无凭证校验与 dry-run
- `POST /api/channels/channel-slack-primary/validate`：返回 `ok=false`、`liveReady=false`，明确指出缺少 `Slack webhook URL`。
- `POST /api/channels/channel-slack-primary/test` 携带 `mode=dry-run`：返回请求预览，证明 dry-run 不再是占位按钮。
- `GET /api/bootstrap`：能看到 `channel-slack-primary.runtime.lastValidatedAt / lastValidationSummary / lastError` 已落盘。

3. 本地 mock 真实发送验证
- 启动本地 mock server：`127.0.0.1:4318`
  - `/slack` 返回纯文本 `ok`
  - `/botmock-token/sendMessage` 返回 Telegram 风格 JSON `{ "ok": true }`
- 更新 Slack 渠道配置为 `http://127.0.0.1:4318/slack`，更新 Telegram 渠道配置为 `http://127.0.0.1:4318`
- Slack 校验：`POST /api/channels/channel-slack-primary/validate` 返回 `ok=true`、`liveReady=true`
- Slack 真实发送：`POST /api/channels/channel-slack-primary/test` 携带 `mode=live` 返回 `delivered=true`
- Telegram 校验：`POST /api/channels/channel-telegram-primary/validate` 返回 `ok=true`、`liveReady=true`
- Telegram 真实发送：`POST /api/channels/channel-telegram-primary/test` 携带 `mode=live` 返回 `delivered=true`
- mock server 收到两条真实请求：
  - `/slack` 收到包含 `text / username / channel` 的 JSON
  - `/botmock-token/sendMessage` 收到包含 `chat_id / text` 的 JSON

4. 项目级渠道绑定验证
- `PUT /api/projects/project-workspace-root` 成功写入两条 `channelBindings`
- `GET /api/bootstrap` 后前端项目页能读取并展示 `room` 与 `alias`

5. 前端浏览器 smoke
- Playwright 打开 `http://127.0.0.1:3187/`：通过
- 渠道页显示：
  - Slack / Telegram 已 configured
  - 配置字段、校验按钮、dry-run 按钮、真实发送按钮
  - 最近一次运行态摘要
- 项目页显示：
  - 渠道绑定切换入口
  - Slack / Telegram 的 `room` 与 `alias` 输入框
- 快照：
  - `.playwright-cli/page-2026-03-09T17-11-30-736Z.yml`
  - `.playwright-cli/page-2026-03-09T17-11-50-809Z.yml`

## 增量执行记录（2026-03-11）
1. 构建验证
- `npm run build`：通过。

2. 启动与 API 烟测
- `npm run start`：服务成功启动在 `http://127.0.0.1:3187`，启动阶段 Slack 自动同步未导致服务崩溃。
- `GET /api/health`：返回 `ok=true`。
- `GET /api/bootstrap`：确认 Slack 渠道对象已包含 `slackMode / slackBotToken / slackAppToken / slackSigningSecret / slackWebhookPath / slackRequireMention / slackDefaultProjectId`，并带有 `connectionState / lastConnectionSummary / lastDisconnectedAt` 等运行态字段。

3. Slack 连接管理烟测
- `POST /api/channels/channel-slack-primary/connect`：在当前 `webhook` 模式下返回结构化报告，摘要为“Slack webhook 模式不需要常驻 socket 连接。”，证明 connect API 已具备模式分支和失败回显。
- `POST /api/channels/channel-slack-primary/disconnect`：返回结构化断开报告。
- `GET /api/bootstrap` 再次确认：`channel-slack-primary.runtime.connectionState=disconnected`，且 `lastConnectionSummary` 已落盘。

4. 前端浏览器 smoke
- Playwright 打开 `http://127.0.0.1:3187/`：通过。
- 切到“渠道”页后，选择 `Slack Bridge`：
  - 可见 `Slack Mode` 切换框
  - 可见 `默认项目`、`默认 Slack Target`、`频道消息要求 @bot`
  - 在 `webhook` 模式下可见 `Slack Webhook URL`
  - 可见 Slack 接入步骤说明与 manifest 片段
  - 可见 `Connect Slack` / `Disconnect Slack` 按钮
  - 可见最近一次运行态中的 `connectionState`、回流状态、路由项目与线程字段
- 快照：
  - `.playwright-cli/page-2026-03-11T13-17-22-918Z.yml`
  - `.playwright-cli/page-2026-03-11T13-17-36-533Z.yml`

## 增量执行记录（2026-03-13）
1. 构建与结构验证
- `npm run build`：通过。
- `wc -l src/App.tsx src/app-support.tsx`：
  - `src/App.tsx = 1440`
  - `src/app-support.tsx = 721`
  - `src/app-support.tsx` 已承载 guide、channel report、cron interpretation 等共享支撑逻辑。

2. 项目内 cron-loop 验证
- `python3 .cron-loop/manage.py validate`：
  - `state_exists=True`
  - `active=1`
  - `paused=0`
  - `validation=ok`
- `python3 .cron-loop/manage.py list`：
  - `active=1`
  - `paused=0`
  - `state_file=/home/sal/OneDrive/CCEO/.cron-loop/cceo-iteration.state.json`
- `GET /api/bootstrap`：已能识别 `project-workspace-root` 下的 `cceo-iteration` job。

3. 前端浏览器 smoke
- Playwright 打开 `http://127.0.0.1:3187/`：通过。
- Cron 页：
  - 可见 `Operator Guide / Current Context / Next Moves`。
  - 可见 `动作解读` 占位卡。
  - 点击 `validate` 后，可见 `cceo-iteration · validate` 结构化解读卡、关键 key/value 字段和原始输出入口。
- 渠道页：
  - Telegram 选中时，可见 `Setup Guide`、保存前检查表和完成后的判定方法。
  - Slack 选中且处于 `webhook` 模式时，可见 mode-specific `Setup Guide`、保存前检查表、Socket Manifest 摘要与展开入口。
- 快照：
  - `.playwright-cli/page-2026-03-12T17-06-44-419Z.yml`
  - `.playwright-cli/page-2026-03-12T17-07-01-308Z.yml`
  - `.playwright-cli/page-2026-03-12T17-08-02-523Z.yml`
  - `.playwright-cli/page-2026-03-12T17-08-22-066Z.yml`
  - `.playwright-cli/page-2026-03-12T17-13-00-369Z.yml`
