# Plan 1

## 本期目标
交付一个可运行的 Codex 总经理 MVP：具备统一 Web UI、总经理聊天面板、角色/会话/知识库/项目/cron 五类核心对象管理，以及真实的 Codex CLI 与 `.cron-loop/` / Qdrant 读取能力。

## 本期范围
- 初始化前后端工程。
- 落地本地数据存储。
- 实现 Codex 运行桥与会话索引。
- 实现角色、项目、知识库、cron 任务 API。
- 实现统一前端和总经理聊天 UI。

## 前置依赖与准备项
- 本机 Node.js 可用。
- `codex` CLI 在 PATH 中可用。
- 本机可访问 `~/.codex`。
- Qdrant 默认探测地址 `http://127.0.0.1:6333`。

## 详细任务列表（按顺序）
1. 建立项目脚手架与目录结构。
2. 建立领域模型与本地 JSON 数据目录。
3. 实现 `codex-runtime-bridge`：
   - 执行 `codex exec --json`
   - 执行 `codex exec resume --json`
   - 构建角色/项目覆盖参数
4. 实现 `session-memory-index`：
   - 扫描 `~/.codex/sessions`
   - 扫描 `~/.codex/archived_sessions`
   - 读取 `history.jsonl` 形成摘要
5. 实现 `knowledge-hub`：
   - 探测 Qdrant
   - 管理 collection 元数据和项目授权
6. 实现 `cron-loop-governor`：
   - 扫描已注册项目的 `.cron-loop/`
   - 输出任务状态、日志摘要和控制命令
7. 实现 `manager-api` REST / SSE。
8. 实现统一前端：
   - 仪表盘
   - 总经理聊天
   - 角色管理
   - 会话管理
   - 知识库管理
   - 项目管理
   - cron 管理
9. 运行测试与 smoke 验证，回写文档状态。

## 交付物清单
- 可运行的本地 Web 管理台。
- 可运行的 API 服务。
- 本地数据目录与示例数据。
- 角色/项目/会话/知识库/cron 的 CRUD 或只读管理能力。
- 总经理聊天面板与 Codex CLI 桥接。

## 验收标准
- 前端能正常启动并加载。
- API 能返回五类核心对象数据。
- 能从前端发起一次真实 Codex 运行或恢复既有 session。
- 能扫描至少一个项目的 `.cron-loop/` 目录。
- 能显示 Qdrant 连通状态。

## 风险与回滚策略
- 若真实 Codex 事件解析复杂，则优先保留原始事件并只提取必要字段。
- 若 Qdrant 不可达，则知识库模块以降级状态返回，不阻塞其余能力。
- 若 cron 控制动作不安全，则第一期保留只读 + 明确命令预览。

## 与后续期衔接
- 为 term_2 预留渠道配置模型和自动化任务编排入口。
- 保证角色/项目/渠道数据结构可扩展，不需大改 term_1 数据。

## 执行状态（2026-03-09）
- 状态：已完成。
- 已交付：
  - React + Vite 统一管理台，可直接打开总览、总经理、角色、会话、知识库、项目、Cron、渠道八个页面。
  - 本地 JSON 注册表与 `.codex-manager/` 运行目录。
  - 本机 `~/.codex/config.toml`、skills、sessions、archived sessions、Qdrant collections、`.cron-loop/` 的真实扫描能力。
  - 总经理聊天桥：支持 `codex exec --json` 与 `codex exec resume --json`，并将最终消息持久化回总经理线程。
  - 角色运行参数物化：模型、profile、personality、web search、verbosity、reasoning、system prompt / developer instructions。
  - 渠道注册表编辑：Slack / Telegram 渠道可在前端保存基础配置和状态。
- 本期偏差：
  - 原计划中的“渠道配置表单”提前落到了 term_1，因此 term_2 将聚焦真实渠道桥接与路由，而不是基础表单。
  - 真实 Slack / Telegram 收发、知识库写入流水线、项目级渠道绑定细化仍留在后续期。
- 结论：
  - Vision 1 至 Vision 5 的 term_1 判据已满足。
  - 本期成果已达到“可运行的 OpenClaw 风格 Codex 管理台 MVP”，不是静态样板。
