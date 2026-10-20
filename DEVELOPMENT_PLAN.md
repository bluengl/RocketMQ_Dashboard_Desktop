# RocketMQ Dashboard Desktop — 开发计划

> 目标：实现对 [apache/rocketmq-dashboard](https://github.com/apache/rocketmq-dashboard) 的一比一对照桌面版，覆盖其全部功能模块。
>
> 本文档是后续执行的唯一依据，每完成一个阶段更新 [PROGRESS.md](PROGRESS.md) 的进度。

---

## 现状基线（2026-10-20）

| 状态 | 内容 |
|------|------|
| ✅ 可用 | 连接/断开 NameServer、Broker 列表（内联 Dashboard）、Topic 列表/路由/新建/删除、消息查询（ID/Key/时间范围）、Consumer 组枚举/在线连接/队列进度/重置位点、Message Trace（按 msgId/Key） |
| ❌ 缺失 | Producer、ACL、OPS；Dashboard/Cluster 的统计与拓扑 |

**阶段 0–3 已修复的历史 bug**
1. `consumer.rs` 曾读取托管 `State`（恒 `None`），与 `connect_cluster` 写入的 `GLOBAL_CLIENT` 不相通；已统一为 `GLOBAL_CLIENT`。
2. `App.tsx` fallback 未排除已实现页面导致 "Coming soon" 叠加；已改为显式排除。
3. `protocol.rs` 中 `GET_ROUTEINTO_BY_TOPIC` 拼写错误；已修正为 `GET_ROUTEINFO_BY_TOPIC`。
4. 前端死代码（未引用的 `src/pages/ConsumersPage.tsx`、`src/hooks/useRocketMQ.ts`、`src/types/index.ts` 重复接口）已清理。
5. 版本号与目录 git 仓库问题已解决。

---

## 阶段 0：基线修复与工程化（预计 1–2 天）

**目标**：修掉全部已知 bug，建立干净、可编译、可提交的基线，作为后续所有功能的地基。

### 任务
1. **修复 Consumer 连接状态** — 统一连接状态存储方案。
   - 推荐：`consumer.rs` 三个命令改为读 `rocketmq::GLOBAL_CLIENT`（与 `topic.rs` 一致，改动最小）。
   - 备选：`connect_cluster` 同时写入托管 `State`。二者选一，全项目统一。
2. **修复 App.tsx 渲染** — 第 292 行 fallback 条件改为排除 `dashboard`/`topics`/`consumers`（或改为显式 match）。
3. **统一前端类型与调用层**：
   - 以实际返回值为准重写 `src/types/index.ts`，删除 `App.tsx` 内联的重复接口。
   - 重写 `src/hooks/useRocketMQ.ts` 为真正的 API 层（只暴露已注册命令），并在页面中统一使用。
4. **清理死代码** — 删除 `src/pages/ConsumersPage.tsx`，保留根目录 `src/ConsumersPage.tsx` 并补齐其功能（或反向合并，二选一后统一）。
5. **版本号对齐** — 统一为 `0.3.0-alpha`（或用户指定）。
6. **git init** — 校验 `.gitignore`（确认 `node_modules`/`dist`/`target` 已忽略），做首次提交。
7. **协议头校验** — 实测 `language: "RUST"`、`version: 0` 是否能被 NameServer/Broker 正确解析（`LanguageCode` 无 RUST 枚举值，需确认是否需要改为 `JAVA` 或 `OTHER`）。

### 验收标准
- 连接后 Consumers 页能正确显示消费者组列表，无 "Coming soon" 叠加。
- `cargo check`、`tsc --noEmit`、`npm run build` 全部通过。
- 有 git 仓库且已提交，`git status` 干净。

---

## 阶段 1：消息查询（Message）（预计 3–4 天）

**目标**：实现 rocketmq-dashboard 最核心的消息查询能力（按 ID / Key / Topic+时间范围）。

### 后端（`src-tauri/src/rocketmq/` + `commands/message.rs`）
- 按 Message ID 查询：`VIEW_MESSAGE_BY_ID`（33）。
- 按 Topic + Key 查询：`QUERY_MESSAGE`（12）+ `extFields["key"]`。
- 按 Topic + 时间范围查询：
  1. `GET_ROUTEINFO_BY_TOPIC`（105）拿到 broker 地址。
  2. `SEARCH_OFFSET_BY_TIMESTAMP`（29）或 `GET_MIN_OFFSET`(31)/`GET_MAX_OFFSET`(30) 定位 offset 区间。
  3. `QUERY_MESSAGE`（12）按 offset 拉取消息。
- 消息详情结构：msgId、topic、tags、keys、brokerName、queueId、queueOffset、storeTimestamp、bornTimestamp、properties、body。
- 注册新命令：`query_message_by_id`、`query_message_by_key`、`query_message_by_topic`。

### 前端（`src/pages/MessagePage.tsx`）
- 查询表单（topic / key / msgId / 时间范围）。
- 消息列表 + 详情抽屉（body 支持文本与 JSON 格式化展示）。
- 在 `App.tsx` 导航中接入真实页面，替换 "Coming soon"。

### 验收标准
- 能按 ID 查到单条消息详情；能按 topic+key 查到消息；能按时间范围列出消息。
- 消息 body/properties 正确展示。

### 依赖
- 阶段 0（统一的 API 层与协议基础）。

---

## 阶段 2：Topic 管理完善（预计 2–3 天）

### 后端
- Topic 路由查询：`GET_ROUTEINFO_BY_TOPIC`（105）。
- Topic 状态（各 broker 队列 offset）。
- 创建/更新 Topic：`UPDATE_AND_CREATE_TOPIC`（17）。
- 删除 Topic：`DELETE_TOPIC_IN_NAMESRV`（216）+ `DELETE_TOPIC_IN_BROKER`（215）。

### 前端（`src/pages/TopicsPage.tsx` 扩展）
- Topic 详情页（路由 / 状态 Tab）。
- 新建 Topic 表单（集群、读写队列数、perm、order）。
- 删除 Topic（二次确认）。

### 验收标准
- 能查看 Topic 路由与状态；能新建、删除 Topic 并生效。

---

## 阶段 3：Consumer 管理完善（已完成，2026-10-20）

### 后端（已实现）
- 消费组枚举：`GET_ALL_SUBSCRIPTIONGROUP_CONFIG`（201，发送到每个 Broker 并聚合）。
- 在线实例：`GET_CONSUMER_CONNECTION_LIST`（203）；返回 206 表示该组未在线。
- 消费进度：`QUERY_CONSUMER_OFFSET`（14，需 `queueId`）+ `GET_MAX_OFFSET`（30）逐队列计算 lag。
- 重置位点：`UPDATE_CONSUMER_OFFSET`（15，extFields 为 `commitOffset`），支持最新/最早/指定值、单队列/全部队列。
- 新命令：`get_consumer_groups`、`get_consumer_connections`、`get_consumer_progress`、`reset_consumer_offset`。

### 前端（已实现）
- Consumers 页：组列表 + 搜索、在线状态、Consume Type / Message Model、汇总卡片（实例数/队列数/总 lag/消费 TPS）。
- 消费 TPS：每 5 秒轮询消费进度，用两次采样间 `Σ consumerOffset` 增量 ÷ 时间差计算（重置位点后清空基线重新采样）。
- 进度表（Broker / Queue / Broker Offset / Consumer Offset / Lag），支持选择 Topic 与手动刷新。
- 在线连接表（Client ID / 地址 / 语言 / 版本）；离线组支持手动选择 Topic 查看已提交位点。
- 重置位点弹窗（Topic、队列、目标位点、二次确认提示）。

### 验证
- 用 Python 探测脚本对测试集群（4.7.7）实测确认请求码与响应结构。
- TPS 算法实测：模拟消费 20 条 / 2.04 秒，采样计算得 9.79 msg/s，与前端公式一致。
- `cargo check`、`tsc --noEmit`、`npm run build` 全部通过。
- 注意：测试集群当前没有在线消费者，因此 203 成功分支的完整客户端列表未在真实环境观察到；协议结构按 RocketMQ 标准响应实现。

---

## 阶段 4：Cluster + Dashboard 完善（预计 2–3 天）

- Broker 运行时信息：`GET_BROKER_RUNTIME_INFO`（28）。
- Broker 统计：`VIEW_BROKER_STATS_DATA`（107）、`GET_BROKER_CONSUME_STATS`（109）。
- 集群拓扑可视化。
- Dashboard TPS / 消息量趋势图（前端图表，需引入图表库并遵循 dataviz 规范）。

### 验收标准
- 能查看 Broker 运行时详情与统计；Dashboard 有 TPS/消息量趋势。

---

## 阶段 5：Producer 查询（预计 1–2 天）

- Producer 连接查询（RocketMQ 5.x 特有，**待核实请求码**）。
- 前端 Producer 页面（按 Topic 查 producer 客户端）。

---

## 阶段 6：Message Trace（已完成）

**结论（核实自 rocketmq-dashboard 源码）**：不存在专用的 `QUERY_MESSAGE_TRACE_BY_ID` 请求码。轨迹数据以普通消息写入 `RMQ_SYS_TRACE_TOPIC`，其 KEYS 即原消息 msgId；查询就是对 trace topic 走 `QUERY_MESSAGE`（12），以 msgId/Key 为 key。

### 已实现
- 后端 `query_message_trace(msgId, traceTopic?)` / `query_message_trace_by_key(key, traceTopic?)`。
- 查询窗口：按原消息的 storeTimestamp 推导（±，最长 1 天）；取不到时回退到最近 1 小时（按 msgId）/ 24 小时（按 key）。
- trace topic 无路由、`TOPIC_NOT_EXIST`(17)、`QUERY_NOT_FOUND`(22)、`NO_MESSAGE`(204) 均返回空轨迹而非报错。
- 解析 trace body（STX 分隔 context、SOH 分隔字段），支持 `Pub` / `SubAfter` / `EndTransaction` / `Recall`，按 msgId 过滤（SubAfter 的 msgId 在第 3 列，其余在第 6 列）。
- 前端 `src/TracePage.tsx`：msgId/Key 双模式查询、自定义 trace topic、时间轴链路、消费状态列表；消息详情页提供 “View Trace” 入口。
- 单测覆盖 trace 解析与 msgId 过滤。

### 验收说明
- 测试集群（192.168.153.149:9876）未启用 trace（无 `RMQ_SYS_TRACE_TOPIC` 路由），端到端轨迹需在 `traceTopicEnable=true` 的 Broker 上复验。

---

## 阶段 7：ACL 权限管理（预计 2 天）

- 用户 CRUD 与权限配置（**待核实 ACL 相关请求码**）。
- 前端 ACL 页面（用户列表、权限编辑）。

---

## 阶段 8：OPS + 多集群 + 打磨（预计 2–3 天）

- Nameserver 管理、多集群切换。
- 大数据量场景：分页 / 虚拟滚动。
- 错误处理完善（区分连接 / 协议 / 数据错误）。
- 打包发布（Windows/macOS/Linux）。

---

## 协议请求码参考表

| 常量 | 请求码 | 状态 |
|------|-------|------|
| GET_ROUTEINFO_BY_TOPIC | 105 | ✅ 已确认 |
| GET_BROKER_CLUSTER_INFO | 106 | ✅ 已确认（当前 protocol.rs 已用） |
| GET_ALL_TOPIC_LIST_FROM_NAMESERVER | 206 | ✅ 已确认（当前 protocol.rs 已用） |
| QUERY_MESSAGE | 12 | ✅ 已确认 |
| VIEW_MESSAGE_BY_ID | 33 | ✅ 已确认 |
| SEARCH_OFFSET_BY_TIMESTAMP | 29 | ✅ 已确认 |
| GET_MIN_OFFSET / GET_MAX_OFFSET | 31 / 30 | ✅ 已确认 |
| GET_EARLIEST_MSG_STORETIME | 32 | ✅ 已确认 |
| QUERY_CONSUMER_OFFSET | 14 | ✅ 已确认（需 queueId，offset 在响应头） |
| UPDATE_CONSUMER_OFFSET | 15 | ✅ 已确认（extFields 用 `commitOffset`） |
| QUERY_BROKER_OFFSET | 13 | ❌ 4.7.7 Broker 不支持；改用 30/31 逐队列查询 |
| UPDATE_AND_CREATE_TOPIC | 17 | ✅ 已确认 |
| GET_BROKER_RUNTIME_INFO | 28 | ✅ 已确认 |
| GET_CONSUMER_LIST_BY_GROUP | 38 | ✅ 已确认 |
| DELETE_TOPIC_IN_NAMESRV | 216 | ✅ 已确认 |
| VIEW_BROKER_STATS_DATA | 107 | ✅ 已确认 |
| GET_BROKER_CONSUME_STATS | 109 | ⚠️ 4.7.7 不支持（code=3），5.x 再验证 |
| GET_ALL_SUBSCRIPTIONGROUP_CONFIG | 201 | ✅ 已实测（消费组枚举入口，发送到 Broker） |
| GET_CONSUMER_CONNECTION_LIST | 203 | ✅ 已实测（返回 206 表示组未在线） |
| GET_CONSUMER_RUNNING_INFO | 204 | ✅ 已确认（不是连接列表） |
| Message Trace | 12（对 `RMQ_SYS_TRACE_TOPIC` 查询） | ✅ 已确认：无专用请求码，trace 消息的 KEYS 即原 msgId |
| Producer 查询 | ? | ⚠️ 待核实 |
| ACL 相关 | ? | ⚠️ 待核实 |

> 阶段 3 已用探测脚本对 4.7.7 测试集群逐项实测；剩余待核实项在对应阶段开始时再确认。
> 注意：200 是 `UPDATE_AND_CREATE_SUBSCRIPTIONGROUP`，不能用于枚举消费组。

---

## 执行约定

- 每个阶段完成后：更新 [PROGRESS.md](PROGRESS.md)、按需更新 [CHANGELOG.md](CHANGELOG.md)，并提交 git。
- 前端改动需在浏览器（Tauri dev）中实测主流程与边界。
- 涉及图表时遵循 dataviz 技能规范；涉及协议时先核实请求码再实现。
