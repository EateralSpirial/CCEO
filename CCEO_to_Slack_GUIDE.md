# CCEO to Slack Guide

作者口径：
把我当成一个理性、简单直接的老师。
这份文档不讲空话，只讲做成这件事的最短路径。

## 目标

从一个已经登录 Slack 的浏览器状态出发，完成下面这件事：

1. 新建一个独立 Slack App，而不是复用旧 bot。
2. 把这个 App 接到本机 CCEO。
3. 让 Slack 可以真实触发本机总经理。
4. 用一条需要读本机文件或进程的消息，证明这不是假联通。

---

## 先记住 5 条原则

1. 不要复用旧 App。
   复用旧 App 最容易造成身份混淆。你会在频道里看到两个同名 bot，后面根本分不清谁在回。

2. 不要只看 UI 成功提示。
   Slack UI 显示保存成功，不等于消息真的能进本机，也不等于本机真的能回到 Slack。

3. 不要把 review/mock 实例当成真实实例。
   这个项目里真实 API 默认是 `127.0.0.1:3187`。
   `127.0.0.1:3197` 是 review/mock 常见端口，可能会把运行态写成“已连接”，但它不一定是真的外部 Slack 连接。

4. 在频道里，当前默认要 `@Bot`。
   当前配置里 `slackRequireMention` 是 `true`，所以频道消息默认需要 `@CCEO` 才会触发。
   私信不需要 `@`。

5. 浏览器不要提前关。
   在完成“创建 App + 安装 + 频道验证 + 双向消息验证 + 工具调用验证”之前，不要关闭 Playwright 浏览器。

---

## 关键文件和入口

先知道要看哪里。

- 真实 API：
  `/home/sal/OneDrive/CCEO/README.md`
  这里写的是 `http://127.0.0.1:3187`

- Slack 渠道配置：
  `/home/sal/OneDrive/CCEO/.codex-manager/registry/channels.json`

- 项目绑定：
  `/home/sal/OneDrive/CCEO/.codex-manager/registry/projects.json`

- Slack 桥接逻辑：
  `/home/sal/OneDrive/CCEO/server/lib/slack-bridge.ts`

- Slack App manifest 样例：
  `/home/sal/OneDrive/CCEO/output/playwright/slack-cceo-final-manifest.json`

- Codex 权限入口：
  `/home/sal/OneDrive/CCEO/server/lib/codex.ts`

---

## 第 0 步：先确认你连的是“真实实例”

这一步非常重要。很多时间都浪费在这里。

### 正确目标

你要操作的是：

- 真实 CCEO API 在 `127.0.0.1:3187`
- 不是 review/mock `3197`

### 怎么看

先看健康检查：

```bash
curl http://127.0.0.1:3187/api/health
```

如果 `3187` 不通，再看 `3197`：

```bash
curl http://127.0.0.1:3197/api/health
```

### 怎么判断 `3197` 是假的

看运行态摘要里有没有这种字样：

- `review server 已模拟 Slack socket 连接`
- `review server 已模拟 Slack 断开`

如果有，就说明你看的不是那条真实外部 Slack 连接。

### 代码依据

项目里有显式的 review mode 分支：

- `server/lib/slack-bridge.ts`
- `const REVIEW_MODE = process.env.CCEO_REVIEW_MODE === "1";`

review mode 下会直接把连接状态写成“已连接”，但不会建立真实 Slack 常驻连接。

---

## 第 1 步：打开浏览器并登录 Slack

如果浏览器会话已经丢了，就重新开。

### Playwright 前提

确认 `npx` 可用：

```bash
command -v npx
```

### 推荐入口

直接打开目标频道，或者先打开 Slack 登录页。

示例：

```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"

"$PWCLI" -s=cceo-slack-setup open https://app.slack.com/client/T0AJRLW7KNJ/C0AJQFX4H9B --headed
```

如果跳到 Slack 登录页，就手工登录工作区。

### 登录完成的标准

不是“我觉得登录了”，而是：

1. 浏览器 URL 已经在 `app.slack.com/client/...`
2. 左侧能看到你的工作区
3. 能切到目标频道，比如 `#clawclaw`

---

## 第 2 步：在 Slack API 后台创建一个独立 App

不要复用旧 App。直接新建。

### 要做的事

1. 进入 `https://api.slack.com/apps`
2. 选择 `Create New App`
3. 选择 `From scratch`
4. 填独立名字

推荐命名：

- `CCEO`
- 以后如果是别的 bot，就用它自己的独立名字

### 为什么不能复用旧 App

因为复用旧 App 会导致：

1. 频道里出现两个同名 bot
2. 你不知道哪条回复来自哪个系统
3. 后续排查 token、事件和消息归属会非常痛苦

---

## 第 3 步：配置 App Manifest

这一段是本次实操里最容易卡住的地方。

### 先给结论

Slack 的 App Manifest 编辑器不是普通 textarea。
它是 CodeMirror。

所以：

- 直接改 `.value`，经常没用
- 看起来改了，保存时其实没吃进去

### 正确做法

如果必须自动化填 manifest，用 CodeMirror API：

```js
document.querySelector('.CodeMirror').CodeMirror.setValue(manifestString)
```

然后再点 `Save Changes`。

### 已验证通过的 manifest 样例

文件：

- `/home/sal/OneDrive/CCEO/output/playwright/slack-cceo-final-manifest.json`

关键点有这些：

1. `socket_mode_enabled: true`
2. `chat:write`
3. `app_mentions:read`
4. `channels:join`
5. `message.channels`
6. `message.im`
7. `message.groups`
8. `message.mpim`

### 为什么这些 scope 必要

- `chat:write`
  没它就发不回 Slack。

- `app_mentions:read`
  没它就读不到 `@CCEO`。

- `channels:join`
  方便 bot 自动加入频道。

- `message.*`
  让 bot 可以接频道、私信、群组消息。

---

## 第 4 步：安装 App，并生成 token

manifest 保存后，继续做两件事：

1. `Install to Workspace`
2. 生成两个 token

### 需要的 token

- Bot Token：`xoxb-...`
- App Level Token：`xapp-...`

### 当前这个项目用的是哪两类

看 `channels.json`：

- `slackBotToken`
- `slackAppToken`

### 不需要什么

当前这套走的是 socket mode。
所以关键是：

- `xoxb`
- `xapp`

不是 webhook，也不是 signing secret 驱动的主链路。

### 安全要求

不要把 token 写进文档、截图、提交记录或聊天消息里。
需要记录时，只记用途，不记明文。

---

## 第 5 步：让 bot 进入目标频道

不要假设安装成功就一定已经在目标频道里。

### 两种方法

1. 在 Slack UI 里手动邀请 bot 进频道
2. 用 Slack API 调 `conversations.join`

示例：

```bash
curl -X POST https://slack.com/api/conversations.join \
  -H "Authorization: Bearer xoxb-REDACTED" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "channel=C0AJQFX4H9B"
```

### 验证标准

返回里要看到：

- `"ok": true`
- `"is_member": true`

---

## 第 6 步：把新 App 写进本机 CCEO 配置

重点是两处。

### 1. Slack 渠道配置

文件：

- `/home/sal/OneDrive/CCEO/.codex-manager/registry/channels.json`

关键字段：

- `name`
- `enabled`
- `config.slackMode`
- `config.slackChannel`
- `config.slackBotToken`
- `config.slackAppToken`
- `config.slackRequireMention`
- `config.slackDefaultProjectId`

### 2. 项目绑定

文件：

- `/home/sal/OneDrive/CCEO/.codex-manager/registry/projects.json`

关键字段：

- `channelBindings[].channelId`
- `channelBindings[].room`
- `channelBindings[].alias`

### 当前这个项目的绑定方式

现在是：

- 渠道：`channel-slack-primary`
- 房间：`C0AJQFX4H9B`
- 别名：`clawclaw / 总经理`

---

## 第 7 步：启动或重连真实 Slack 桥接

只改配置不够。还要让真实实例把 Slack socket 拉起来。

### 真实 API 端口

默认：

```bash
http://127.0.0.1:3187
```

### 常用接口

校验：

```bash
curl -X POST http://127.0.0.1:3187/api/channels/channel-slack-primary/validate
```

连接：

```bash
curl -X POST http://127.0.0.1:3187/api/channels/channel-slack-primary/connect
```

整体状态：

```bash
curl http://127.0.0.1:3187/api/bootstrap
```

### 通过标准

运行态里至少要看到这些：

- `connectionState: connected`
- `lastConnectionOk: true`
- `lastConnectionSummary` 类似 `Slack socket 已连接`

---

## 第 8 步：先做“纯出站”测试

先验证本机能否往 Slack 发消息。

### 调用方式

```bash
curl -X POST http://127.0.0.1:3187/api/channels/channel-slack-primary/test \
  -H "Content-Type: application/json" \
  -d '{"mode":"live","message":"【总经理】桥接测试"}'
```

### 你要看的不是只有 HTTP 200

还要同时确认：

1. Slack 频道里真的出现了消息
2. 显示身份是新 bot，不是旧 bot
3. runtime 里 `lastDeliveryOk: true`

---

## 第 9 步：再做“入站 + 回包”测试

这是第一条真正闭环测试。

### 推荐测试消息

在目标频道里发：

```text
@CCEO 只回复“OK-REAL”
```

### 通过标准

1. Slack 频道或 thread 里真的收到 `CCEO` 回包
2. 本机 `api/bootstrap` 里出现新的：
   - `lastInboundAt`
   - `lastThreadId`
   - `lastRoutedProjectId`
3. 本机 `.codex-manager/generated/run-*.last-message.txt` 里出现最终消息

### 当前这套逻辑的两个行为

1. 频道里默认要 `@CCEO`
   因为 `slackRequireMention` 现在是 `true`

2. 频道回复默认走 thread
   代码里频道消息会把 reply 发到 `threadTs ?? ts`

### 私信规则

私信 `CCEO` 不需要 `@`。

---

## 第 10 步：做“工具调用”验证

如果你只测“你好”或者“现在几点”，不够。
那只能证明回复通了，不能证明它真有本机执行权。

### 正确做法

发一条必须读取本机文件或进程的任务。

本次已验证通过的例子：

```text
@CCEO 工具调用测试：请检查本机 ~/OneDrive/BFT/.cron-loop 的最近 2 轮 cron，并按以下格式回复：1）每轮开始时间；2）当前状态或退出状态；3）关键进度摘要；4）对应日志或消息文件路径。要求基于实际本机文件和进程，不要猜测。
```

### 为什么这条测试有效

因为它必须同时做到：

1. 进入本机文件系统
2. 识别 `.cron-loop` 的 run log 和 message 文件
3. 区分“已结束”和“仍在运行”
4. 把结果回发到 Slack

### 验证方式

把 Slack 回复和本机文件对比：

- `/home/sal/OneDrive/BFT/.cron-loop/run.20260315_180001.log`
- `/home/sal/OneDrive/BFT/.cron-loop/message.20260315_180001.md`
- `/home/sal/OneDrive/BFT/.cron-loop/run.20260315_173001.log`
- `/home/sal/OneDrive/BFT/.cron-loop/message.20260315_173001.md`

如果时间、状态、摘要、路径都能对上，才算通过。

---

## 第 11 步：确认总经理拿到的是本机高权限，不是缩水版

这一步要看代码，不要靠猜。

文件：

- `/home/sal/OneDrive/CCEO/server/lib/codex.ts`

当前关键参数是：

- `approval_policy="never"`
- `sandbox_mode="danger-full-access"`

这说明 Slack 触发的总经理使用的是本机高权限执行路径。

---

## 常见坑

### 坑 1：复用旧 App

现象：

- 频道里出现两个同名 bot
- 看不懂是谁在回复

处理：

- 直接新建独立 App
- 新名字，新 token，新 bot user

### 坑 2：manifest 改了但 Slack 没吃进去

现象：

- UI 看起来保存过
- 但 scope 或事件其实没生效

处理：

- 记住编辑器是 CodeMirror
- 用 CodeMirror API 写入

### 坑 3：bot 装好了，但不在目标频道

现象：

- 本机 live test 成功
- 频道里看不到它
- 或者提及无反应

处理：

- 手动邀请
- 或 `conversations.join`

### 坑 4：以为 `3197` 已连 Slack，所以就算成功

现象：

- runtime 写着 connected
- 但摘要里出现 `review server 已模拟 Slack socket 连接`

处理：

- 不算成功
- 真实入口看 `3187`

### 坑 5：双实例同时跑

现象：

- `3187` 和 `3197` 都在写运行态
- 你看到的状态互相覆盖

处理：

- 保留一个真实实例
- review/mock 只在前端审计时单独开
- 做 Slack 验证时不要让 mock 改写运行态

### 坑 6：频道里没 `@CCEO` 就以为 bot 坏了

现象：

- 私信能用
- 频道里不回

处理：

- 看 `slackRequireMention`
- 当前默认在频道里要 `@CCEO`

### 坑 7：看到入站了，就以为回包一定成功

现象：

- `lastInboundAt` 更新了
- 但 Slack 没看到回复

处理：

- 继续看：
  - `.codex-manager/generated/run-*.last-message.txt`
  - `lastDeliveryAt`
  - `lastDeliveryOk`
  - Slack thread 实际消息

---

## 重启后的恢复清单

如果电脑重启，照这个顺序恢复，不要乱。

1. 先确认真实实例端口
   - 看 `3187`
   - 不要先看 `3197`

2. 再确认 Slack 配置没丢
   - 看 `channels.json`
   - 看 `projects.json`

3. 重新打开 Playwright 浏览器
   - 回到 Slack 工作区

4. 手工重新登录 Slack
   - 不要假设会话还在

5. 调 `validate` 和 `connect`
   - 让真实 socket 重新建立

6. 先做 live 出站测试
   - 证明能发到 Slack

7. 再做 `@CCEO` 闭环测试
   - 证明 Slack 能触发本机 run 并回包

8. 最后做工具调用测试
   - 证明它真的有本机执行权

---

## 最短成功路线

如果你只想最快做成，下次照这 10 行走：

1. 开真实 API：`3187`
2. 确认不是 review/mock：不要被 `3197` 骗
3. 打开 Playwright 浏览器并登录 Slack
4. 新建独立 Slack App
5. 用 manifest 开 `socket_mode` 和必要 scopes
6. 安装 App，拿到 `xoxb` 和 `xapp`
7. 让 bot 加入目标频道
8. 更新 `channels.json` 和 `projects.json`
9. `validate` + `connect`
10. 依次做：
   - live 出站测试
   - `@CCEO` 闭环测试
   - 本机工具调用测试

---

## 本次实操已经验证过的结论

这不是理论步骤，是已经跑通过的结论。

1. 独立 App `CCEO` 可以成功替代旧的复用方案。
2. `@CCEO` 在 `#clawclaw` 里可以真实触发本机总经理。
3. 私信 `CCEO` 也可以触发，不需要 `@`。
4. Slack 回复默认进 thread。
5. 总经理确实能从 Slack 读取本机 `~/OneDrive/BFT/.cron-loop` 并返回最近两轮 cron 的真实摘要。
6. review/mock 端口 `3197` 会污染运行态判断，做 Slack 真验证时必须避开。

---

## 给后续加别的 bot 的一句话建议

一 bot 一 app，一套 token，一次完整闭环验证。
不要偷懒复用旧 bot，不要只测“能发消息”，一定要补一条“必须读取本机真实文件或进程”的工具调用测试。
