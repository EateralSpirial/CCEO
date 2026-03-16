# Codex Executive Officer

Short name: `CCEO`

CCEO 是一个面向本机 Codex 生态的统一治理台。它参考 OpenClaw 的管理思路，但目标不是再造一个聊天壳，而是把本机上的 Codex 项目、角色、会话、知识库、渠道和 cron-loop 拉到同一张“运营桌面”上。

## 当前能力

- 统一 Web 管理台，包含总览、总经理、角色、会话、知识库、项目、Cron、渠道八个主工作面
- 总经理聊天面板，使用真实 `codex exec` / `codex exec resume`
- 角色管理：模型、推理力度、verbosity、system prompt、developer instructions、技能、MCP、工具和渠道身份
- 会话索引：读取 `~/.codex/sessions` 与 archived sessions，并允许链接回项目与角色
- Qdrant 知识库管理：默认指向本机 `http://127.0.0.1:6333`
- 项目治理：经理角色、参与角色、知识库权限、渠道绑定
- 渠道管理：
  - Slack `socket / webhook / http` 模式
  - Telegram 基础桥接
  - 配置校验、dry-run、真实发送测试
  - Slack connect / disconnect 与消息回流框架
- cron-loop 管理：
  - 扫描项目 `.cron-loop/` 平铺文件
  - 调用官方 `manage_cron.mjs` 执行 `start / stop / validate / paths / destroy`
  - 项目自身的 singleton 持续迭代 loop

## 前端目标

CCEO 的前端目标不是“把所有字段露出来”，而是做到：

- 人类可读：先让用户知道当前页是干什么的
- 说明详细：告诉用户该准备什么输入、下一步应该去哪
- 灵活而且强大：既能做管理，也能做真实桥接和自动化

因此主界面已经加入：

- 统一说明层
- 当前工作上下文卡
- 动态“下一步建议”
- 复杂工作面的详细工作流说明卡
- 更结构化的渠道结果卡，减少原始 JSON 直出

## 详细文档

- `docs/Feature-Inventory.md`
  - 当前功能清单、对象模型、操作入口、实现状态、已知边界
- `docs/Frontend-Operator-Manual.md`
  - 前端复杂功能的逐步操作手册、前置条件、常见失败点、结果判定方法

## 本地开发

```bash
npm install
npm run dev
```

这会启动：

- Vite：`http://127.0.0.1:5173`
- API：`http://127.0.0.1:3187`

生产构建：

```bash
npm run build
npm start
```

生产服务会从 `dist/client` 提供前端资源。

## 目录与运行数据

### 项目数据

运行数据位于 `.codex-manager/`：

- `registry/`
  保存 personas、projects、knowledge bases、channels、manager threads、session links
- `generated/personas/<id>/instructions.md`
  保存角色物化后的指令文件

### 项目内 cron-loop

项目自身的持续迭代任务位于 `.cron-loop/`：

- `.cron-loop/prompt.md`
- `.cron-loop/runner.sh`
- `.cron-loop/latest.md`
- `.cron-loop/ledger.md`
- `.cron-loop/state.json`
- `.cron-loop/issues.registry.json`
- `.cron-loop/issues.events.jsonl`
- `.cron-loop/issues.summary.md`
- `.cron-loop/issues.rules.json`
- `.cron-loop/manage.mjs`

常用命令：

```bash
node .cron-loop/manage.mjs list
node .cron-loop/manage.mjs validate
node .cron-loop/manage.mjs stop
node .cron-loop/manage.mjs start
```

默认安装计划：

- `17 */4 * * *`

即每 4 小时的第 17 分钟运行一次 CCEO 项目唯一的 singleton loop。

默认超时：

- `12600` 秒

之所以不是高频轮询，是因为当前自管理任务要求每轮都先跑严格前端审判，再做 Playwright 全盘检查，单轮预算明显高于普通 cron smoke。

## 当前自我迭代闭环

当前项目的 singleton `cron-loop` 每轮都按下面顺序推进：

1. 构建当前项目
2. 启动审计专用预览服务
3. 运行 `strict-frontend-auditor` 全审判
4. 门禁通过后再运行 Playwright 全盘巡检
5. 更新：
   - `docs/Feature-Inventory.md`
   - `docs/Frontend-Operator-Manual.md`
   - `.plans/Frontend-Iteration.md`
   - `.cron-loop/ledger.md`
   - `.cron-loop/latest.md`

## Slack 接入说明

推荐优先使用 Slack `socket mode`，原因是：

- 不依赖公网 webhook
- 更接近你本机现有 OpenClaw 的工作方式
- 更适合本地开发和持续调试

在 CCEO 前端里：

1. 进入“渠道”页
2. 选择 `Slack Bridge`
3. 切到 `socket` 模式
4. 填入 `xoxb-...` Bot Token 和 `xapp-...` App Token
5. 保存后执行 `Connect Slack`

## 说明

- 总经理运行桥会把角色配置真正映射成 Codex 运行参数。
- `replaceBuiltInInstructions` 会切换到生成的 `model_instructions_file`。
- 会话索引只读取 `.jsonl` 头部，避免把大 transcript 全量吃进内存。
- cron-loop 仍然使用 skill 提供的 canonical `manage_cron.mjs`，没有另造格式。
