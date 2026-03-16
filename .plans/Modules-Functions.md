# Modules Functions

## 模块总览（文字化结构图）
- `manager-shell` [term_1]
  统一 Web UI 壳层、导航、仪表盘、聊天入口。
- `manager-api` [term_1]
  提供 REST / SSE 接口，统一读写本机状态。
- `registry-store` [term_1]
  持久化角色、项目、知识库、渠道配置与审计日志。
- `codex-runtime-bridge` [term_1]
  封装 `codex exec`、`codex exec resume`、session 扫描、运行事件解析。
- `session-memory-index` [term_1]
  纳管 `~/.codex/sessions`、`archived_sessions`、`history.jsonl`，形成可检索会话索引。
- `persona-toolkit` [term_1]
  管理人格、指令文件、profile、工具集、MCP 和技能快照。
- `knowledge-hub` [term_1]
  管理知识库元数据与 Qdrant 连接状态。
- `project-governor` [term_1]
  管理项目、总经理角色、项目级工具/MCP/知识库权限与 session 绑定。
- `cron-loop-governor` [term_1]
  兼容扫描各项目 `.cron-loop/`，统一展示与操作任务。
- `channel-connector` [term_2]
  Slack / Telegram 渠道配置、路由与回流抽象。
- `operator-guidance-layer` [term_2]
  为主要工作面提供人类说明、下一步建议、空态引导与结构化结果呈现。
- `knowledge-ingestion-jobs` [term_2]
  知识库同步、嵌入、Qdrant collection 治理与定时刷新。
- `manager-automation` [term_2]
  总经理长期任务、自动轮询、调度编排与项目内代理编队。
- `security-audit` [term_3]
  细粒度操作审计、角色隔离策略、敏感配置保护。

## 功能到模块映射
- 统一前端聊天入口 -> `manager-shell` + `manager-api` + `codex-runtime-bridge` [term_1]
- 角色人格管理 -> `persona-toolkit` + `registry-store` [term_1]
- 历史对话/记忆管理 -> `session-memory-index` + `registry-store` [term_1]
- 知识库管理 -> `knowledge-hub` + `project-governor` [term_1]
- 项目管理 -> `project-governor` + `registry-store` [term_1]
- cron-loop 管理 -> `cron-loop-governor` + `project-governor` [term_1]
- Slack / Telegram 接入 -> `channel-connector` [term_2]
- 前端说明层与易读性增强 -> `operator-guidance-layer` + `manager-shell` [term_2]
- 自动知识库更新 -> `knowledge-ingestion-jobs` + `cron-loop-governor` [term_2]
- 总经理主动调度与 CCEO 自身持续迭代 -> `manager-automation` + `codex-runtime-bridge` + `cron-loop-governor` [term_2]
- 权限与审计增强 -> `security-audit` [term_3]

## 模块职责定义
### `manager-shell` [term_1]
- 职责：统一 UI、布局、聊天面板、管理标签页、状态概览。
- 输入：REST/SSE 数据。
- 输出：用户交互、操作提交、状态展示。

### `manager-api` [term_1]
- 职责：HTTP API、事件流、服务编排。
- 输入：前端请求。
- 输出：规范化 JSON、实时事件、错误模型。

### `registry-store` [term_1]
- 职责：将角色、项目、知识库、渠道、审计数据写入本项目本地数据目录。
- 输入：领域对象。
- 输出：可审计 JSON 文档。

### `codex-runtime-bridge` [term_1]
- 职责：启动/恢复 Codex、解析 `--json` 事件、构建运行参数。
- 输入：角色配置、项目配置、用户 prompt、session id。
- 输出：运行结果、事件流、失败上下文。

### `session-memory-index` [term_1]
- 职责：扫描本机 Codex 会话与归档，建立索引。
- 输入：`~/.codex/sessions`、`~/.codex/archived_sessions`、`history.jsonl`。
- 输出：会话列表、摘要、归档状态、项目绑定关系。

### `persona-toolkit` [term_1]
- 职责：角色定义、默认/替换指令、MCP/技能/工具集清单、渠道话术元数据。
- 输入：角色编辑请求。
- 输出：角色记录、Codex config override、instructions 文件。

### `knowledge-hub` [term_1]
- 职责：Qdrant 连接信息、collection 清单、项目授权。
- 输入：知识库配置、Qdrant 探测结果。
- 输出：知识库目录、状态、项目授权关系。

### `project-governor` [term_1]
- 职责：项目注册、总经理角色、项目级配置、session 参与关系。
- 输入：项目路径、角色 id、知识库权限、渠道配置。
- 输出：项目快照、运行上下文。

### `cron-loop-governor` [term_1]
- 职责：扫描和解析 `.cron-loop/` 平铺文件；构建 pause/resume/install/validate 能力。
- 输入：已注册项目路径。
- 输出：任务清单、状态、日志摘要、控制动作。

### `channel-connector` [term_2]
- 职责：管理 Slack / Telegram / 未来渠道的消息入口与投递策略。
- 输入：渠道凭证与路由配置。
- 输出：消息桥接、渠道状态。

### `operator-guidance-layer` [term_2]
- 职责：让主要页面具备清晰的用途说明、下一步建议、空态、工作流说明和结构化结果呈现，减少用户对技术细节的直接负担。
- 输入：当前选中的角色、项目、渠道，以及 bootstrap 得到的真实系统状态。
- 输出：面向操作者的引导卡片、动态建议、复杂页工作流说明、可读报告。

## 输入/输出契约
- 角色对象：
  - 输入：名称、作用域、personality、instructions、developerInstructions、useDefaultInstructions、model/profile、skills、mcps、toolset、channelStyle。
  - 输出：角色记录 id、运行覆盖参数、指令文件路径。
- 项目对象：
  - 输入：路径、名称、经理角色、参与角色、项目级 MCP/技能/工具、知识库权限、关联渠道。
  - 输出：项目快照、任务列表、会话列表、运行默认参数。
- 会话对象：
  - 输入：Codex session 文件信息 + 项目/角色挂接元数据。
  - 输出：可恢复标识、摘要、最后活动时间。
- cron 任务对象：
  - 输入：`.cron-loop/*.state.json`、`*.prompt.md`、`*.ledger.*` 等。
  - 输出：任务状态、最近日志、控制动作能力。

## 依赖关系
- `manager-shell` 依赖 `manager-api`。
- `manager-api` 依赖 `registry-store`、`codex-runtime-bridge`、`session-memory-index`、`knowledge-hub`、`project-governor`、`cron-loop-governor`。
- `manager-shell` 额外依赖 `operator-guidance-layer`。
- `project-governor` 依赖 `persona-toolkit`、`knowledge-hub`、`session-memory-index`。
- `cron-loop-governor` 依赖 `project-governor`。
- `manager-automation` 后续依赖 `codex-runtime-bridge` 与 `cron-loop-governor`。

## 可复用性说明
- `codex-runtime-bridge` 设计为无 UI 依赖，可被后续 Slack/Telegram 渠道与长期任务复用。
- `session-memory-index` 可独立用于会话归档工具或命令行管理工具。
- `cron-loop-governor` 面向平铺 `.cron-loop/` 标准，可复用于其他项目。

## 扩展策略
- 通过 `registry-store` 把领域对象与真实运行状态解耦。
- 通过 `channel-connector` 抽象不同外部平台，不让 Slack/Telegram 逻辑污染核心模块。
- 通过“角色模板 + 项目覆盖 + 运行时 prompt”的三层模型支持更多 Codex 使用形态。

## 设计权衡与取舍
- 第一期开源式先做本地单用户管理面，不先上多用户权限。
- 第一期开启“真实 Codex 桥接”和“真实 `.cron-loop` 扫描”，但渠道收发先做抽象与配置，不在无现成凭证下强行接通。
- 配置优先保存在本项目数据目录，再在执行时映射为 Codex override；避免直接覆写全局 `~/.codex/config.toml`。

## 未决问题与提问记录
- 2026-03-09：是否直接复用 OpenClaw 的 Slack 扩展还是只桥接现有配置？默认先做桥接抽象。
- 2026-03-09：是否为每个角色单独维护 `CODEX_HOME` 影子目录？第一期默认采用“项目数据目录 + 运行时 override”而非复制整套 home。
