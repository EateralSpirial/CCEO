# Test 1

## 测试范围
- 核心后端领域服务：
  - 角色、项目、知识库、会话、cron 模块
- Codex 运行桥
- 前端页面的基础加载与主要交互

## 测试用例列表
1. 正常流程：启动服务后，`/api/health` 返回健康状态。
2. 正常流程：角色 CRUD 接口可创建并返回角色记录。
3. 正常流程：项目创建后可绑定经理角色和知识库权限。
4. 正常流程：会话索引能读取本机 `~/.codex/sessions` 至少一个 session。
5. 正常流程：Qdrant 探测接口返回可达或不可达的明确状态。
6. 正常流程：cron 扫描接口对存在 `.cron-loop/` 的项目返回任务列表。
7. 正常流程：前端能打开总经理聊天页面并提交一条 prompt。
8. 异常流程：Qdrant 不可达时，API 以降级状态返回而不是崩溃。
9. 异常流程：项目目录不存在 `.cron-loop/` 时，返回空列表。
10. 异常流程：Codex session 文件损坏时，索引模块记录错误并跳过。

## 通过标准
- 服务能启动，无阻塞性异常。
- 核心 API 测试全部通过。
- 前端构建成功。
- 至少一条 Codex 桥接 smoke 用例通过。

## 实际执行记录（2026-03-09）
1. 构建验证
- `npm run build:server`：通过。
- `npm run build:web`：通过。
- `npm run build`：通过。

2. 核心健康检查
- `GET /api/health`：通过。
- 返回 `codex-cli 0.112.0`，Qdrant `http://127.0.0.1:6333` 可达，并成功列出本机 collections。
- `GET /api/bootstrap`：通过，返回角色、项目、渠道、会话、知识库与 cron 聚合数据。

3. 总经理桥接 smoke
- 新运行用例：`POST /api/manager/chat`，角色 `persona-d86d28a0-e9bf-44ee-a917-ee41a309d6ef`，提示词 `Reply with exactly OK and nothing else.`。
- 运行结果：`runId=86b9fe51-b11c-413b-8344-b22f8b9701af`，`status=completed`，`finalMessage=OK`。
- 线程结果：创建 session `019cd32e-4ffd-79f2-ba4e-7b7e93014174`，最终 assistant 消息成功写回 `thread-governor-main`。
- 恢复运行用例：`POST /api/manager/chat` 携带上述 `sessionId`，提示词 `Reply with exactly AGAIN and nothing else.`。
- 运行结果：`runId=ad396ea7-69da-4b1f-9bbe-9c4ccc198153`，`status=completed`，`finalMessage=AGAIN`。
- 结论：`codex exec` 与 `codex exec resume` 两条路径均通过。

4. 渠道管理 smoke
- `PUT /api/channels/channel-telegram-primary`：通过。
- 返回状态显示 `enabled=true`、`status=configured`，说明 term_1 的渠道注册表已支持保存。

5. 前端浏览器 smoke
- 使用 Playwright 打开 `http://127.0.0.1:3187/`：通过。
- 总览页加载正常，显示真实 Codex / MCP / Qdrant 数据。
- 渠道页加载正常，展示渠道清单与可编辑表单。
- 快照：
  - `.playwright-cli/page-2026-03-09T15-22-33-084Z.yml`
  - `.playwright-cli/page-2026-03-09T15-22-46-475Z.yml`

## 未覆盖项
- 未主动制造 Qdrant 离线场景，仅验证了在线降级路径不会报错。
- 未主动构造损坏的 session 文件进行异常注入。
- 未验证真实 Slack / Telegram 消息收发；term_1 仅完成渠道对象模型与前端编辑。
