# CCEO 功能清单

## 1. 项目定位
CCEO（Codex Executive Officer）是一个面向本机 Codex 生态的统一治理台。它不是单纯聊天壳，而是把以下对象放进同一套浏览器操作面和同一条总经理运行链里：

- Codex 角色人格
- Codex 历史会话与记忆归属
- Qdrant 知识库
- 项目级治理配置
- Slack / Telegram 渠道桥接
- 项目内与跨项目的 `.cron-loop/` 任务

## 2. 当前前端工作面

### 2.1 总览
用途：
- 快速判断本机 Codex、Qdrant、MCP、项目、知识库与渠道是否处于可治理状态。

当前能力：
- 显示角色、会话、Cron、MCP 数量
- 显示默认模型、已发现技能、已发现 MCP、Qdrant collections
- 显示 trusted project 根路径
- 显示知识库健康状态
- 显示当前上下文与下一步建议

### 2.2 总经理
用途：
- 作为统一治理入口，把角色、项目、旧会话上下文注入一次真实 Codex 运行。

当前能力：
- 发送新的治理 prompt
- 选择角色、项目、是否恢复旧 session
- 读取并显示总经理主线程消息
- 读取实时运行事件流
- 显示命令预览、运行状态和事件时间线

### 2.3 角色
用途：
- 管理人格、system prompt、developer instructions、模型和工具边界。

当前能力：
- 新建 / 编辑角色
- 管理名称、描述、作用域、personality、model、reasoning、verbosity
- 管理 `useProjectDocs` 与 `replaceBuiltInInstructions`
- 管理 system prompt 与 developer instructions
- 选择技能、MCP、工具集
- 管理渠道身份、回复规则、发言风格

### 2.4 会话
用途：
- 复用 `~/.codex/sessions` 与 archived sessions 中的历史资产。

当前能力：
- 扫描活动会话与归档会话
- 显示 session id、cwd、更新时间
- 把会话重新挂接到项目与角色
- 为会话写备注，便于后续 resume

### 2.5 知识库
用途：
- 把本机 Qdrant collection 管理成项目可绑定资产。

当前能力：
- 管理知识库名称、描述、URL、collection、只读标记
- 显示 Qdrant 在线状态
- 让项目声明可读与可写知识库

### 2.6 项目
用途：
- 定义项目治理边界，让角色、知识库、渠道和会话有真实归属。

当前能力：
- 新建 / 编辑项目
- 管理项目名称、路径、经理角色、参与角色
- 管理可读知识库、可写知识库
- 管理渠道绑定
- 为每条渠道绑定维护 `room` 与 `alias`

### 2.7 Cron
用途：
- 统一查看和操作项目内 `.cron-loop/` singleton loop。

当前能力：
- 扫描当前项目对应的 cron-loop singleton loop
- 显示 schedule、loop 状态、最近摘要
- 执行 `validate / stop / start / paths / destroy`
- 对动作输出做结构化人类解读

### 2.8 渠道
用途：
- 统一管理 Slack / Telegram 接入与消息投递路径。

当前能力：
- Slack `socket / webhook / http` 三种模式
- Telegram 基础桥接配置
- 保存配置、校验配置、Dry Run、真实发送测试
- Slack Connect / Disconnect
- 显示最近一次连接、校验、投递和回流摘要
- 显示模式化接入说明、保存前检查表与完成判定

## 3. 领域对象模型

### 3.1 PersonaDefinition
关键字段：
- `name`
- `description`
- `scope`
- `personality`
- `model`
- `reasoningEffort`
- `verbosity`
- `webSearch`
- `profile`
- `useProjectDocs`
- `replaceBuiltInInstructions`
- `systemPrompt`
- `developerInstructions`
- `skills`
- `mcpServers`
- `tools`
- `channelIdentity`

### 3.2 ProjectDefinition
关键字段：
- `name`
- `path`
- `managerPersonaId`
- `participantPersonaIds`
- `projectMcpServers`
- `projectSkills`
- `projectTools`
- `knowledgeBaseIds`
- `writableKnowledgeBaseIds`
- `channelBindings`

### 3.3 KnowledgeBaseDefinition
关键字段：
- `name`
- `description`
- `scope`
- `url`
- `collectionName`
- `readOnly`

### 3.4 ChannelDefinition
关键字段：
- `type`
- `name`
- `enabled`
- `status`
- `identity`
- `notes`
- `config`
- `runtime`

Slack 关键配置：
- `slackMode`
- `slackWebhookUrl`
- `slackChannel`
- `slackBotToken`
- `slackAppToken`
- `slackSigningSecret`
- `slackWebhookPath`
- `slackRequireMention`
- `slackDefaultProjectId`

Telegram 关键配置：
- `telegramBotToken`
- `telegramChatId`
- `telegramApiBaseUrl`

### 3.5 SessionSummary
关键字段：
- `sessionId`
- `cwd`
- `lastUpdatedAt`
- `archived`
- `projectId`
- `personaId`
- `notes`

### 3.6 CronJobSummary
关键字段：
- `id`
- `projectId`
- `job`
- `schedule`
- `status`
- `latestMessage`

说明：
- 当前版本每个项目只允许一个 singleton cron-loop，所以这里的 `job` 是项目级 loop 标签，不再代表多 job 架构。

## 4. 当前已落地的真实桥接

### 4.1 Codex 运行桥
已落地：
- `codex exec`
- `codex exec resume`
- 运行事件时间线解析
- 角色 / 项目 / session 参数拼装

### 4.2 Qdrant
已落地：
- 读取本机 `http://127.0.0.1:6333`
- 探测 reachability
- 读取 collections

未落地：
- 文档入库同步流水线
- 向量写入编排
- collection 生命周期自动化

### 4.3 Slack
已落地：
- socket / webhook / http 配置模型
- 配置校验
- dry-run / live 测试
- socket connect / disconnect
- 运行态持久化
- 回流框架与路由基础

待继续强化：
- 真实生产 token 场景联调
- 更细的频道访问与提及策略

### 4.4 Telegram
已落地：
- token / chat id / api base 配置
- 配置校验
- dry-run / live 测试

待继续强化：
- 消息回流
- 更完整的聊天上下文路由

### 4.5 Cron Loop
已落地：
- 项目内 `.cron-loop/` 平铺管理器
- CCEO 项目级 singleton 自我迭代 loop
- `validate / stop / start / paths / destroy / list`
- 最新摘要、状态文件、账本、日志

当前默认计划：
- `17 */4 * * *`

当前默认超时：
- `12600` 秒

## 5. 文档与说明层现状
当前已落地三层说明：

- 顶部总览说明层
  - 当前页用途
  - 当前上下文
  - 动态下一步建议
- 复杂页工作流说明层
  - 推荐使用顺序
  - 完成判定
  - 常见闭环提醒
- 仓库级详细文档
  - 本文件：功能清单
  - `docs/Frontend-Operator-Manual.md`：逐步操作手册

## 6. 已知边界
- 当前仍以单用户本机治理为主，不提供多用户权限隔离。
- 知识库仅完成连接与映射层，未完成自动同步与落库流水线。
- Telegram 目前重点是配置与投递验证，回流尚未完善。
- 渠道凭证默认保存在本项目数据目录，尚未接入独立密钥管理方案。
- 严格前端审计与 Playwright 全盘巡检已进入 CCEO 自我迭代回路，后续文档与前端说明会按轮次持续补齐。

## 7. 本轮迭代新增
- 修复了 `cron-loop` 运行环境准备逻辑，确保从任意非交互位置启动时也能找到 `codex / node / npm / npx`
- 强化了 CCEO 项目级 singleton 自我管理任务，纳入严格前端审计门禁与 Playwright 全盘巡检
- 为复杂工作面补充了更细的浏览器内工作流说明
- 补齐仓库级功能清单与操作手册文档目录
