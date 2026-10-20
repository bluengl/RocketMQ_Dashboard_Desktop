# RocketMQ Dashboard 桌面版 - 开发进度

> **最新进展（2026-10-20）**：阶段 0 基线修复、阶段 1 消息查询、阶段 2 Topic 管理、阶段 3 Consumer 管理（组枚举/连接/进度/重置位点）已完成。开发计划见 [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)。

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

### 📋 8. Dashboard 概览（0%）
- [ ] 集群总览指标
- [ ] TPS 实时统计
- [ ] 消息堆积监控
- [ ] 实时图表

### 📋 9. 运维工具（0%）
- [ ] 重置消费位点
- [ ] 发送测试消息
- [ ] 清理过期消息
- [ ] 配置管理

### 📋 10. ACL 权限管理（0%）
- [ ] 用户列表
- [ ] 权限配置
- [ ] 白名单管理

### 📋 11. 消息轨迹（0%）
- [ ] 轨迹查询
- [ ] 链路展示

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

1. **Cluster + Dashboard 完善** (阶段 4，优先级：高)
   - Broker 运行时信息与统计数据
   - Dashboard TPS / 消息量趋势图

2. **Producer 查询** (阶段 5)
   - 需先核实 RocketMQ 5.x Producer 查询请求码

3. **Message Trace** (阶段 6)
   - 需先核实轨迹查询请求码

4. **ACL 权限管理** (阶段 7)
   - 需先核实 ACL 相关请求码

5. **OPS + 多集群 + 打包** (阶段 8)
   - 多集群切换、大数据量分页、错误分类、打包发布

## 已知问题

1. 当前未实现 ACL 认证（NameServer 未启用 ACL 时可正常使用）
2. 消费者组查询协议可能需要连接 Broker（当前仅连接 NameServer）
3. 某些统计数据需要从多个 Broker 聚合

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
