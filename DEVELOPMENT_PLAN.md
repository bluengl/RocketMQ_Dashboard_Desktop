# RocketMQ Dashboard Desktop — 开发计划

> 目标：实现对 [apache/rocketmq-dashboard](https://github.com/apache/rocketmq-dashboard) 的一比一对照桌面版，覆盖其全部功能模块。
>
> 本文档是后续执行的唯一依据，每完成一个阶段更新 [PROGRESS.md](PROGRESS.md) 的进度。

---

## 现状基线（2026-10-20）

| 状态 | 内容 |
|------|------|
| ✅ 可用 | 连接/断开 NameServer、Broker 列表（内联 Dashboard）、Topic 名称列表 |
| ⚠️ 有 bug / 未接线 | Consumer（列表/进度/连接）：后端命令读托管 `State`（恒 `None`），前端仅接线了组列表 |
| ❌ 缺失 | Message、Message Trace、Producer、ACL、OPS；Topic/Consumer 的运维操作；Dashboard/Cluster 的统计与拓扑 |

**关键已确认 bug**
1. `consumer.rs` 三个命令读 `State<Mutex<Option<RocketMQClient>>>`，但 `connect_cluster` 写的是静态 `GLOBAL_CLIENT`，两者不相通 → Consumers 页永远 "Not connected"。
2. `App.tsx:292` 的 fallback 未排除 `consumers`，导致 Consumers 页叠加渲染 "Coming soon"。
3. `protocol.rs` 中 `GET_ROUTEINTO_BY_TOPIC` 拼写错误（应为 `GET_ROUTEINFO_BY_TOPIC`），且该常量未被使用。
4. 前端存在死代码：`src/pages/ConsumersPage.tsx`（未引用）、`src/hooks/useRocketMQ.ts`（引用不存在的 `test_connection`/`list_brokers` 命令）、`src/types/index.ts`（形状与 `App.tsx` 内联接口不一致）。
5. 版本号不一致：`package.json`/`Cargo.toml`/`tauri.conf.json` 为 `1.0.0`，文档为 `0.3.0-alpha`。
6. 当前目录不是 git 仓库（有 `.gitignore` 但未 `git init`）。

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

## 阶段 3：Consumer 管理完善（预计 3–4 天）

### 后端
- 消费进度：`QUERY_CONSUMER_OFFSET`（14）按 topic 查各队列 offset 与 lag。
- 在线实例：`GET_CONSUMER_CONNECTION_LIST`（**待核实请求码**，当前硬编码 204，可能是 203）。
- 消费组列表来源：**待核实**（当前硬编码 200，需确认 rocketmq-dashboard 如何枚举 consumer group，可能需连 Broker 而非 NameServer）。
- 重置消费位点：`UPDATE_CONSUMER_OFFSET`（15）或 5.x 的 `RESET_CONSUMER_CLIENT_OFFSET`（**待核实**）。

### 前端（`src/ConsumersPage.tsx` 扩展）
- Consumer 详情页（进度表、客户端连接列表、重置 offset）。
- 消费 TPS / 堆积汇总卡片。

### 验收标准
- 选中消费组后能看到消费进度、在线实例，并能重置位点。

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

## 阶段 6：Message Trace（预计 1–2 天）

- 消息轨迹查询（`QUERY_MESSAGE_TRACE_BY_ID`，**待核实请求码**）。
- 轨迹链路展示（生产 / 存储 / 消费全链路）。

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
| QUERY_CONSUMER_OFFSET | 14 | ✅ 已确认（当前 consumer.rs 已用） |
| UPDATE_CONSUMER_OFFSET | 15 | ✅ 已确认 |
| QUERY_BROKER_OFFSET | 13 | ✅ 已确认 |
| UPDATE_AND_CREATE_TOPIC | 17 | ✅ 已确认 |
| GET_BROKER_RUNTIME_INFO | 28 | ✅ 已确认 |
| GET_CONSUMER_LIST_BY_GROUP | 38 | ✅ 已确认 |
| DELETE_TOPIC_IN_NAMESRV | 216 | ✅ 已确认 |
| VIEW_BROKER_STATS_DATA | 107 | ✅ 已确认 |
| GET_BROKER_CONSUME_STATS | 109 | ✅ 已确认 |
| GET_ALL_CONSUMER_GROUP | 200 | ⚠️ 待核实（当前 consumer.rs 硬编码，来源不明） |
| GET_CONSUMER_CONNECTION_LIST | 203 或 204 | ⚠️ 待核实（当前硬编码 204） |
| GET_CONSUMER_RUNNING_INFO | 200 或 204 | ⚠️ 待核实 |
| QUERY_MESSAGE_TRACE_BY_ID | ? | ⚠️ 待核实 |
| Producer 查询 | ? | ⚠️ 待核实 |
| ACL 相关 | ? | ⚠️ 待核实 |

> 待核实项在对应阶段开始时，对照 [rocketmq-dashboard 源码](https://github.com/apache/rocketmq-dashboard) 的 Controller 与 RocketMQ `RequestCode.java` 确认准确值。

---

## 执行约定

- 每个阶段完成后：更新 [PROGRESS.md](PROGRESS.md)、按需更新 [CHANGELOG.md](CHANGELOG.md)，并提交 git。
- 前端改动需在浏览器（Tauri dev）中实测主流程与边界。
- 涉及图表时遵循 dataviz 技能规范；涉及协议时先核实请求码再实现。
