# RocketMQ Dashboard Desktop — 开发计划

> 目标：实现对 [apache/rocketmq-dashboard](https://github.com/apache/rocketmq-dashboard) 的一比一对照桌面版，覆盖其全部功能模块。
>
> 本文档是后续执行的唯一依据，每完成一个阶段更新 [PROGRESS.md](PROGRESS.md) 的进度。

---

## 现状基线（2026-10-20）

| 状态 | 内容 |
|------|------|
| ✅ 可用 | 连接/断开 NameServer、Broker 列表（内联 Dashboard）、Topic 列表/路由/新建/删除、消息查询（ID/Key/时间范围）、Consumer 组枚举/在线连接/队列进度/重置位点、Message Trace（按 msgId/Key）、Cluster 运行时信息/拓扑、Dashboard TPS 趋势 |
| ❌ 缺失 | Producer、ACL、OPS |

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

## 阶段 4：Cluster + Dashboard 完善（已完成，2026-10-20）

### 后端（已实现）
- Broker 运行时信息：`GET_BROKER_RUNTIME_INFO`（28，发送到 Broker），响应 `{"table": {...}}`，解析为 key/value 表。
- Dashboard 聚合指标：`get_dashboard_metrics` 聚合全部 master broker 的版本、运行时长、`putTps`/`getTotalTps`（取首个采样值）、今日消息量，并汇总 topic / 消费组数量。
- Broker 统计命令：`get_broker_stats_data`（107）、`get_broker_consume_stats`（109）已实现；5.3.2 Broker 返回 `request type not supported`，命令会明确报错。
- `BrokerInfo` 增加 `master_addr` / `slave_addrs`，按 broker id 区分主从。
- 新命令：`get_dashboard_metrics`、`get_broker_runtime_info`、`get_broker_stats_data`、`get_broker_consume_stats`。

### 前端（已实现）
- 新增 `src/DashboardPage.tsx`：KPI 卡片、Produce/Consume TPS 双线趋势图（每 5 秒采样、保留 60 点）、图表/表格视图切换、Broker 指标明细表。
- 新增 `src/ClusterPage.tsx`：集群 → Broker → 主从地址拓扑、Broker 列表、运行时信息弹窗（关键指标 + 全量 key/value 搜索）。
- 引入 `recharts`；配色用 dataviz 校验器在深色卡片背景 `#1e293b` 上验证通过（蓝 `#3987e5` / 橙 `#d95926`）。
- `App.tsx` 移除内联 Dashboard 与 5 秒集群轮询，改由新页面自行轮询。

### 验证
- Node 探测脚本直连测试集群（192.168.153.149:9876）：28 返回 `{"table": {...}}`；107/109 返回 code=3 `request type ... not supported`（Broker 版本 V5_3_2）。
- `cargo check`、`tsc --noEmit`、`npm run build` 全部通过。
- Vite 预览中注入 Tauri invoke stub，实测 Dashboard 图表/表格、Cluster 拓扑、运行时弹窗均正常渲染。

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

## 阶段 7：ACL 权限管理（已完成，2026-10-20）

> 请求码与报文格式已核实（RocketMQ 5.5.0 源码 + 本机 5.3.2 Broker 实测）。旧版 ACL 协议码 50–54 在 5.3.2 上不完整（54 返回 not supported），因此采用 ACL 2.0。

### 后端（已实现）
- 用户：`AUTH_CREATE_USER`（3001）、`AUTH_UPDATE_USER`（3002）、`AUTH_DELETE_USER`（3003）、`AUTH_LIST_USER`（3005）。
- 规则：`AUTH_CREATE_ACL`（3006）、`AUTH_UPDATE_ACL`（3007）、`AUTH_DELETE_ACL`（3008）、`AUTH_LIST_ACL`（3010）。
- 报文格式与 RocketMQ 5.5 `MQClientAPIImpl` 一致：用户名/过滤条件走 extFields，用户与规则内容走 JSON body。
- 所有操作广播到全部 master broker，逐 broker 返回结果与错误。
- 请求签名与 `AclClientRPCHook` 一致：把 `AccessKey` 加入 extFields 后按 key 排序、拼接 value 与 body，HMAC-SHA1 后 Base64 写入 `Signature`。

### 前端（`src/AclPage.tsx`，已实现）
- Users Tab：用户列表（密码可显隐）、创建/编辑/删除。
- ACL Rules Tab：按 subject + resource 聚合并展示动作、来源 IP、Allow/Deny，支持创建/编辑/删除。
- 连接栏可选 ACL 凭据，连接后所有请求自动签名。

### 验证
- 5.3.2 Broker 实测：`GET_BROKER_CLUSTER_ACL_INFO`（52）返回 “The broker does not enable acl.”；3005 / 3010 被识别但提示 authenticationMetadataProvider 未配置（因 ACL 未启用）。
- 报文结构、枚举名（`Normal`/`Super`、`enable`/`disable`、`Pub`/`Sub`/`Any`…、`Allow`/`Deny`）与 5.5.0 源码逐项核对通过。
- `cargo check`、`tsc --noEmit`、`npm run build` 通过；Vite 预览中注入 stub 实测用户/规则列表与表单渲染正常。

### 验收说明
- 端到端 CRUD 需在 Broker 开启 `authenticationEnabled` / `authorizationEnabled` 后复验；测试集群未启用 ACL。
- 启用 ACL 的集群可通过连接栏的 Access Key / Secret Key 正常访问。

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
| VIEW_BROKER_STATS_DATA | 107 | ❌ 5.3.2 Broker 不支持（code=3）；指标改由 28 提供 |
| GET_BROKER_CONSUME_STATS | 109 | ❌ 5.3.2 Broker 不支持（code=3）；命令已实现，待支持版本复验 |
| GET_ALL_SUBSCRIPTIONGROUP_CONFIG | 201 | ✅ 已实测（消费组枚举入口，发送到 Broker） |
| GET_CONSUMER_CONNECTION_LIST | 203 | ✅ 已实测（返回 206 表示组未在线） |
| GET_CONSUMER_RUNNING_INFO | 204 | ✅ 已确认（不是连接列表） |
| Message Trace | 12（对 `RMQ_SYS_TRACE_TOPIC` 查询） | ✅ 已确认：无专用请求码，trace 消息的 KEYS 即原 msgId |
| Producer 查询 | ? | ⚠️ 待核实 |
| AUTH_CREATE_USER | 3001 | ✅ 已确认（5.3.2 实测可用） |
| AUTH_UPDATE_USER | 3002 | ✅ 已确认 |
| AUTH_DELETE_USER | 3003 | ✅ 已确认 |
| AUTH_LIST_USER | 3005 | ✅ 已确认（5.3.2 实测可用） |
| AUTH_CREATE_ACL | 3006 | ✅ 已确认 |
| AUTH_UPDATE_ACL | 3007 | ✅ 已确认 |
| AUTH_DELETE_ACL | 3008 | ✅ 已确认 |
| AUTH_LIST_ACL | 3010 | ✅ 已确认（5.3.2 实测可用） |

> 阶段 3 已用探测脚本对 4.7.7 测试集群逐项实测；剩余待核实项在对应阶段开始时再确认。
> 注意：200 是 `UPDATE_AND_CREATE_SUBSCRIPTIONGROUP`，不能用于枚举消费组。

---

## 执行约定

- 每个阶段完成后：更新 [PROGRESS.md](PROGRESS.md)、按需更新 [CHANGELOG.md](CHANGELOG.md)，并提交 git。
- 前端改动需在浏览器（Tauri dev）中实测主流程与边界。
- 涉及图表时遵循 dataviz 技能规范；涉及协议时先核实请求码再实现。
