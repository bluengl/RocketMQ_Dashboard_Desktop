# RocketMQ Dashboard 桌面版 - 开发进度

> **最新进展（2026-10-20）**：阶段 0 基线修复、阶段 1 消息查询、阶段 2 Topic 管理、阶段 3 Consumer 管理（组枚举/连接/进度/重置位点）、阶段 4 Cluster + Dashboard（运行时信息/拓扑/TPS 趋势）、阶段 5 Producer 查询、阶段 6 Message Trace、阶段 7 ACL（用户/规则 CRUD + 请求签名）、阶段 8 OPS/多集群/分页/错误分类/打包配置 已完成。开发计划见 [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)。

## 测试记录（2026-10-20）

测试环境：`192.168.153.149:9876`（NameServer）、`192.168.153.149:10911`（Broker，V5_3_2）。

**后端只读联调（真实集群）**

| 命令 | 结果 |
|------|------|
| `connect_cluster` / `get_cluster_info` | ✅ 1 broker / 13 topics |
| `get_topic_list` / `get_topic_route` | ✅ 解析正确 |
| `get_consumer_groups` | ✅ 8 个组（201，逐 Broker 聚合） |
| `get_consumer_progress`（离线组 + topic） | ✅ 返回已提交位点 |
| `get_consumer_progress`（离线组无 topic） | ✅ 明确提示需选择 topic |
| `get_producer_groups` / `get_producer_connections` | ✅ 空结果 |
| `get_dashboard_metrics` | ✅ 指标与运行时长正常 |
| `get_broker_runtime_info` | ✅ 60 项指标，含 `runtime`/`putTps`/`getTotalTps` |
| `query_message_by_time` | ✅ 空结果（集群无消息） |
| `query_message_trace` / `query_message_trace_by_key` | ✅ 未启用 trace 时返回空轨迹 |
| `list_acl_users` | ✅ ACL 未启用时返回逐 Broker 错误（UI 正常展示） |

**前端 UI 实测（Vite + Tauri invoke stub，逐页验证）**

Dashboard、Topics（列表/路由/创建弹窗/权限）、Consumers（组列表/进度/连接/TPS 采样）、Producers、Messages（ID 查询/详情/body 解码/View Trace）、Trace、Cluster（拓扑/运行时弹窗）、ACL（用户/规则/错误提示）、OPS（Profile 弹窗）、断开连接后各页空态 —— 均正常，无渲染异常。

**本次发现并修复的问题**

1. **`query_message_by_id` 缺少 `offset`（严重）**：`VIEW_MESSAGE_BY_ID`(33) 按 commitlog 物理偏移查询，原实现未从 msgId 解出偏移，Broker 抛 `NullPointerException: ViewMessageRequestHeader.getOffset()`。已改为从 msgId 后 8 字节解码 offset 并发送（[client.rs](src-tauri/src/rocketmq/client.rs) `decode_msg_id`）。
2. **查询无结果被当作错误**：`query_message_by_key` 在无匹配时 Broker 返回 `QUERY_NOT_FOUND`(22)，前端因此显示红色错误。现已将 22 视为空结果。
3. **缺少错误边界（严重）**：任一页面渲染异常会导致整个应用白屏。新增 [ErrorBoundary.tsx](src/components/ErrorBoundary.tsx)，按页面隔离并可重试；已用异常数据实测验证。
4. **Topic 权限显示**：`perm=7` 原显示为数字 `7`，现按位解析为 `READ | WRITE | INHERIT`。
5. **消息页初始空态**：查询前提示 "No messages found" 改为引导文案。
6. **死代码**：移除未使用的 `send_generic_request`，`cargo check` 恢复 0 warning。

**未能端到端验证（环境限制）**

- 集群内无业务消息 → 消息成功响应的 body 解析（JSON 数组）未在真实消息上验证。
- 无在线消费者/生产者 → 连接列表成功分支未实测。
- Trace 未启用、ACL 未启用 → 对应成功分支未实测。
- Topic 创建/删除、重置位点、ACL CRUD 属写操作，未在真实集群执行。

## 项目概述
基于 Tauri 2 + React 18 + TypeScript 的 RocketMQ 管理控制台桌面应用

## 技术栈
- **前端**: React 18 + TypeScript + Vite 5
- **UI**: 自定义组件 + lucide-react 图标
- **桌面框架**: Tauri 2.8
- **Rust 依赖**: 
  - 原生 TCP 协议实现（直接连接 NameServer）
  - tokio (异步运行时)
  - serde/serde_json (序列化)

## 测试环境
- **NameServer**: 192.168.153.149:9876
- **状态**: 可连接

## 已完成功能

### ✅ 1. 连接管理（100%）
- [x] 配置连接信息（NameServer 地址）
- [x] 测试连接功能
- [x] 连接状态显示
- [x] 断开连接功能
- [x] 连接配置持久化

**实现细节**:
- Rust 端实现了完整的 RocketMQ 协议编解码
- 支持 RemotingCommand 协议（JSON 序列化）
- TCP 连接超时保护（5秒连接超时，10秒读取超时）
- 4 字节 Big-Endian 长度头 + JSON Body

### ✅ 2. 集群管理（100%）
- [x] 获取集群信息（Broker 列表）
- [x] 显示 Broker 详情（名称、集群、地址、在线状态）
- [x] 集群拓扑可视化

**实现的 RocketMQ 协议**:
- `GET_BROKER_CLUSTER_INFO` (Code: 103)
- 返回 `brokerAddrTable`、`clusterAddrTable` 结构
- 解析 Broker 主从关系

### ✅ 3. Topic 管理（100%）
- [x] 获取所有 Topic 列表
- [x] Topic 列表展示（名称、Broker 数量）
- [x] Topic 详情查看

**实现的 RocketMQ 协议**:
- `GET_ALL_TOPIC_LIST_FROM_NAMESERVER` (Code: 17)
- 返回 `topicList` 数组

### ✅ 4. 前端路由和导航（100%）
- [x] React Router v6 集成
- [x] 侧边栏导航
- [x] Dashboard 页面
- [x] Cluster 页面
- [x] Topics 页面
- [x] Consumers 页面（页面已创建）

### ✅ 5. Rust 后端命令系统（100%）
- [x] `connect_cluster` - 连接集群
- [x] `disconnect_cluster` - 断开连接
- [x] `test_connection` - 测试连接
- [x] `get_cluster_info` - 获取集群信息
- [x] `get_topic_list` - 获取 Topic 列表
- [x] `get_consumer_groups` - 获取消费者组列表（已实现）
- [x] `get_consumer_progress` - 获取消费进度（已实现）
- [x] `get_consumer_connections` - 获取消费者连接（已实现）

**通用协议支持**:
- `send_generic_request(request_code, ext_fields)` - 通用请求方法，支持所有 RocketMQ 协议

## 进行中功能

### ✅ 6. Consumer 管理（100%）
- [x] 消费者组列表（按 Broker 聚合订阅组配置）
- [x] 消费进度查询（按队列展示 broker offset / consumer offset / lag）
- [x] 在线实例列表
- [x] 重置消费位点（最新 / 最早 / 指定 offset，支持单队列或全部队列）
- [x] 前端详情页（在线状态、汇总卡片、进度表、连接表、重置弹窗）
- [x] 消费 TPS 卡片（每 5 秒采样 consumer offset 增量计算，含自动刷新）

**已实现并实测确认的协议**:
- `GET_ALL_SUBSCRIPTIONGROUP_CONFIG` (Code: 201) - 消费组枚举（发送到 Broker）
- `GET_CONSUMER_CONNECTION_LIST` (Code: 203) - 在线客户端；返回 206 表示组未在线
- `QUERY_CONSUMER_OFFSET` (Code: 14) - 消费位点，需 queueId，offset 在响应头
- `UPDATE_CONSUMER_OFFSET` (Code: 15) - 重置位点，extFields 使用 `commitOffset`
- `GET_MAX_OFFSET` / `GET_MIN_OFFSET` (Code: 30 / 31) - broker 位点，offset 在响应头

> 注：200 是 `UPDATE_AND_CREATE_SUBSCRIPTIONGROUP`（不是消费组列表），204 是 `GET_CONSUMER_RUNNING_INFO`（不是连接列表）；此前代码中的用法已修正。

## 待实现功能

### 📋 7. 消息查询（0%）
- [ ] 按 Message ID 查询
- [ ] 按 Topic + Key 查询
- [ ] 按 Offset 查询
- [ ] 消息详情展示
- [ ] 消息体查看

### ✅ 8. Cluster + Dashboard（100%）
- [x] 集群总览指标（Broker / Topic / 消费组 / 生产 TPS / 消费 TPS）
- [x] Broker 运行时信息（版本、运行时长、今日消息量、TPS、磁盘容量等全量字段）
- [x] TPS 实时趋势图（每 5 秒采样，保留 60 个点，支持图表/表格切换）
- [x] 集群拓扑可视化（集群 → Broker → master/slave 地址）
- [x] Broker 运行时详情弹窗（关键指标 + 全量 key/value 搜索）

**实现要点**:
- `GET_BROKER_RUNTIME_INFO`（28，发送到 Broker）返回 `{"table": {...}}`，一次请求即可覆盖 Dashboard 所需指标
- `get_dashboard_metrics` 聚合全部 master broker 的指标并汇总 topic / 消费组数量
- 前端使用 `recharts`，图表配色经 dataviz 校验器在深色卡片背景上验证
- `VIEW_BROKER_STATS_DATA`（107）与 `GET_BROKER_CONSUME_STATS`（109）命令已实现，但 5.3.2 Broker 返回 "request type not supported"，需在支持该请求码的版本上使用

### ✅ 9. OPS + 多集群 + 打磨（100%）
- [x] NameServer Profile 管理（增删改、ACL 凭据、localStorage 持久化）
- [x] 多集群切换（连接前自动断开当前集群）
- [x] 列表分页（Topic / Consumer / Producer / Message / ACL，10–100 条每页）
- [x] 错误分类展示（Connection / Protocol / Data / Unknown）
- [x] 多平台图标、`build:desktop` 脚本、`v*` 标签 CI 发布工作流

**实现要点**:
- `src/OpsPage.tsx` 与连接栏共用 `connectTo`，切换集群时先断开再连接
- `usePagination` + `Pagination` 组件统一分页交互
- `ErrorNotice` + `classifyError` 按连接 / 协议 / 数据错误分类并高亮
- 安装包需在对应操作系统构建；CI 产物为 Draft Release，需人工确认发布

### ✅ 10. ACL 权限管理（100%）
- [x] 用户列表（用户名 / 密码 / 类型 / 状态，按 broker 聚合去重）
- [x] 用户创建、更新、删除（广播到所有 master broker）
- [x] ACL 规则列表（按 subject + resource 聚合）
- [x] 规则创建、更新、删除（动作、来源 IP、Allow/Deny）
- [x] 连接时可选 ACL 凭据，所有请求按 RocketMQ ACL 算法签名（HMAC-SHA1）

**实现要点**:
- 使用 ACL 2.0 请求码：`AUTH_CREATE_USER`(3001)、`AUTH_UPDATE_USER`(3002)、`AUTH_DELETE_USER`(3003)、`AUTH_LIST_USER`(3005)、`AUTH_CREATE_ACL`(3006)、`AUTH_UPDATE_ACL`(3007)、`AUTH_DELETE_ACL`(3008)、`AUTH_LIST_ACL`(3010)
- 4.x 旧协议码 50–54 在 5.3.2 Broker 上不完整（54 返回 not supported），因此不采用
- 用户/规则变更广播到所有 master broker；各 broker 的结果与错误分别返回并在页面提示
- 规则资源格式：`topic:xxx`、`group:xxx`、`*`；动作：`Pub`/`Sub`/`Any`/`Create`/`Update`/`Delete`/`Get`/`List`/`All`；决策：`Allow`/`Deny`
- 当前测试集群（5.3.2）未启用认证/授权元数据存储，列表返回
  `The authenticationMetadataProvider is not configured`，需在 Broker 开启 `authenticationEnabled` / `authorizationEnabled` 后才能读写 ACL

### ✅ 11. 消息轨迹（100%）
- [x] 按 Message ID 查询轨迹
- [x] 按 Key 查询轨迹
- [x] 自定义 trace topic（默认 `RMQ_SYS_TRACE_TOPIC`）
- [x] 链路时间轴（produce / consume / endTransaction / recall）
- [x] 消费状态列表

**实现要点**:
- 轨迹数据作为普通消息写入 `RMQ_SYS_TRACE_TOPIC`，KEYS 即原消息 msgId
- 查询走 `QUERY_MESSAGE` (12)，以 msgId / key 检索，无需专用请求码
- trace topic 无路由或查询为空时返回空轨迹，不报错
- 单测覆盖 trace body 解析与 msgId 过滤

### ✅ 12. Producer 查询（100%）
- [x] 生产者组枚举（`GET_ALL_PRODUCER_INFO` 328）
- [x] 在线生产者连接（`GET_PRODUCER_CONNECTION_LIST` 204）
- [x] 可选 Topic 限定查询的 Broker 范围
- [x] 前端 Producer 页面（组列表/搜索、连接表）

**实现要点**:
- 328 发送到每个 master broker，聚合 `data` 的 key 作为生产者组
- 204 的 extFields 为 `producerGroup`，响应 `connectionSet` 按 clientId + clientAddr 去重
- 组未注册时 Broker 返回 `not exist`，按空列表处理
- 测试集群无在线生产者，成功分支需在有生产者的环境复验

## 项目结构

```
rocketmqMg/
├── src/                          # React 前端
│   ├── App.tsx                   # 主应用和路由
│   ├── pages/
│   │   ├── DashboardPage.tsx     # Dashboard 页面
│   │   ├── ClusterPage.tsx       # 集群管理页面
│   │   ├── TopicsPage.tsx        # Topic 管理页面
│   │   └── ConsumersPage.tsx     # Consumer 管理页面
│   └── main.tsx
├── src-tauri/                    # Tauri 后端
│   ├── src/
│   │   ├── main.rs               # 入口，注册所有命令
│   │   ├── commands/             # Tauri 命令模块
│   │   │   ├── mod.rs
│   │   │   ├── cluster.rs        # 集群管理命令
│   │   │   ├── topic.rs          # Topic 管理命令
│   │   │   └── consumer.rs       # Consumer 管理命令 ✅ 新增
│   │   └── rocketmq/             # RocketMQ 客户端
│   │       ├── mod.rs
│   │       ├── client.rs         # TCP 连接和协议处理
│   │       └── protocol.rs       # 协议定义
│   └── Cargo.toml
└── package.json
```

## 技术亮点

### 1. 原生协议实现
- 不依赖官方 Rust SDK（当前 rocketmq-rust 尚不成熟）
- 直接实现 RocketMQ Remoting 协议
- 支持所有 NameServer 和 Broker 管理命令

### 2. 协议编解码
```rust
// 请求格式:
[4 字节长度(Big-Endian)] + [JSON Header + Body]

// Header 结构:
{
  "code": 103,          // 请求码
  "language": "RUST",
  "version": 1,
  "opaque": 1,         // 请求 ID
  "flag": 0,           // 标志位
  "extFields": {...},  // 扩展字段
  "serializeTypeCurrentRPC": "JSON"
}
```

### 3. 类型安全
- TypeScript 前端类型完整
- Rust 后端强类型
- Serde 序列化/反序列化

### 4. 错误处理
- Rust Result 类型
- 前端统一错误提示
- 连接超时保护

## 下一步计划

1. **安装包验证**
   - 在 Windows / macOS / Linux 上执行 `npm run build:desktop`，验证安装与启动

2. **可选运维工具**
   - 发送测试消息、清理过期消息

## 已知问题

1. 当前未实现 ACL 认证（NameServer 未启用 ACL 时可正常使用）
2. 消费者组查询协议可能需要连接 Broker（当前仅连接 NameServer）
3. 某些统计数据需要从多个 Broker 聚合
4. 测试集群（192.168.153.149:9876）未启用消息轨迹（无 `RMQ_SYS_TRACE_TOPIC` 路由），trace 端到端需在 `traceTopicEnable=true` 的 Broker 上复验

## 测试方法

### 启动应用
```bash
npm run tauri dev
```

### 连接测试
1. 输入 NameServer 地址：`192.168.153.149:9876`
2. 点击"连接"按钮
3. 验证连接状态显示为"已连接"

### 查看集群信息
1. 点击侧边栏"Cluster"
2. 查看 Broker 列表
3. 验证 Broker 信息正确

### 查看 Topic 列表
1. 点击侧边栏"Topics"
2. 查看所有 Topic
3. 验证 Topic 数量和名称

---

**最后更新**: 2026-10-20 15:20
**当前版本**: v0.3.0-alpha
**编译状态**: ✅ 通过
**运行状态**: ✅ 正常运行
