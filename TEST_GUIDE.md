# RocketMQ Dashboard 测试指南

## 当前进度

### ✅ 已完成功能

1. **基础架构**
   - Tauri 2 + React 18 + TypeScript + Vite 5
   - 深色主题 UI（slate/navy 配色）
   - 响应式布局

2. **RocketMQ 协议实现**
   - RemotingCommand 编解码（JSON 序列化）
   - TCP 连接管理
   - 集群信息查询（GET_BROKER_CLUSTER_INFO）

3. **连接管理功能**
   - NameServer 地址配置
   - 连接测试
   - 实时连接状态显示

4. **集群概览功能**
   - Broker 列表展示
   - 集群统计信息（Brokers、Topics、Consumer Groups）

### 🔧 当前可测试

应用已编译并运行，可以进行以下测试：

#### 1. 连接测试
1. 打开应用窗口
2. 在 "NameServer Address" 输入框中输入：`192.168.153.149:9876`
3. 点击 "Connect" 按钮
4. 观察连接状态：
   - 成功：状态变为 "Online"（绿色）
   - 失败：显示错误消息

#### 2. 集群信息查看
连接成功后：
- **Cluster Overview** 部分会显示：
  - Brokers：Broker 总数
  - Topics：Topic 总数（当前固定为 0，后续实现）
  - Consumer Groups：消费者组总数（当前固定为 0，后续实现）

- **Broker List** 会显示：
  - Broker Name：Broker 名称
  - Cluster：集群名称
  - Address：Broker 地址列表
  - Version：版本（当前显示 Unknown）
  - Status：在线状态

### 📋 预期测试结果

如果 RocketMQ 正常运行，你应该看到：

```
Connection Status: Online

Cluster Overview
├─ Brokers: 1 (或更多)
├─ Topics: 0
└─ Consumer Groups: 0

Broker List
┌────────────┬─────────┬─────────────────────┬─────────┬────────┐
│ Name       │ Cluster │ Address             │ Version │ Status │
├────────────┼─────────┼─────────────────────┼─────────┼────────┤
│ broker-a   │ Default │ 192.168.153.149:... │ Unknown │ Online │
└────────────┴─────────┴─────────────────────┴─────────┴────────┘
```

### 🔍 验证 RocketMQ 是否运行

在虚拟机上运行以下命令：

```bash
# 检查 NameServer 是否运行
ps aux | grep namesrv

# 检查 Broker 是否运行
ps aux | grep broker

# 检查端口是否监听
netstat -tlnp | grep 9876
```

### 🚧 待实现功能

根据原始 RocketMQ Dashboard 功能清单：

1. **Dashboard 首页**
   - 实时 TPS 图表
   - 消息堆积监控
   - Broker 负载热力图

2. **Topic 管理** (`/topics`)
   - Topic 列表查询
   - 创建/更新/删除 Topic
   - Topic 消息路由信息
   - 发送测试消息

3. **Consumer 管理** (`/consumers`)
   - 消费者组列表
   - 消费进度查询
   - 重置消费位点
   - 在线实例管理

4. **Message 查询** (`/messages`)
   - 按 MessageId 查询
   - 按 Topic + Key 查询
   - 消息详情展示
   - 消息重发

5. **ACL 权限管理** (`/acl`)
   - 用户列表
   - 权限配置
   - IP 白名单管理

6. **消息轨迹** (`/trace`)
   - 消息生产链路
   - 消息消费链路
   - 耗时分析

7. **运维工具** (`/ops`)
   - 性能测试
   - 配置对比
   - 消息导出

### 🛠️ 技术实现细节

#### RocketMQ 协议格式

```
+-------------------+
| Total Length (4B) |  ← 整个包的总长度（不包含自身）
+-------------------+
| Header Len (4B)   |  ← JSON Header 长度（高字节存储序列化类型）
+-------------------+
| Header (JSON)     |  ← RemotingCommand 序列化后的 JSON
+-------------------+
| Body (Optional)   |  ← 响应数据（如集群信息的 JSON）
+-------------------+
```

#### 请求代码定义

- `105`: GET_ROUTEINTO_BY_TOPIC（查询 Topic 路由）
- `106`: GET_BROKER_CLUSTER_INFO（查询集群信息）✅ 已实现
- `206`: GET_ALL_TOPIC_LIST_FROM_NAMESERVER（查询 Topic 列表）

#### 响应代码

- `0`: SUCCESS
- `非 0`: 错误码（remark 字段包含错误信息）

### 📝 开发笔记

#### 已解决的技术问题

1. **UTF-8 编码**：使用 PowerShell 写入文件时必须指定 UTF-8 without BOM
2. **Tokio Mutex**：全局客户端使用 `tokio::sync::Mutex` 以支持异步访问
3. **协议解析**：需要正确处理 Big Endian 字节序
4. **连接超时**：设置 5 秒连接超时，10 秒读取超时

#### 下一步开发优先级

1. **Topic 列表查询**：实现 `GET_ALL_TOPIC_LIST_FROM_NAMESERVER`
2. **路由信息查询**：实现 `GET_ROUTEINTO_BY_TOPIC`
3. **Consumer 管理**：查询消费者组和消费进度
4. **实时监控面板**：创建透明浮动窗口显示 TPS

### 🐛 已知问题

1. Topic 和 Consumer Groups 总数当前固定返回 0
2. Broker 版本信息未解析
3. 未实现连接失败后的自动重试
4. 未实现多 NameServer 的负载均衡

### 💡 测试建议

1. 在虚拟机上启动 RocketMQ（确保 NameServer 和 Broker 都在运行）
2. 测试正常连接场景
3. 测试连接失败场景（关闭 RocketMQ 或输入错误地址）
4. 测试重连功能（先连接，断开，再连接）
5. 检查 Broker 列表是否正确显示

---

## 快速开始

```bash
# 启动开发模式
npm run tauri dev

# 构建生产版本
npm run tauri build
```

## 配置文件位置

- Windows: `%APPDATA%\com.rocketmq-dashboard.desktop\config.json`
- Linux: `~/.config/com.rocketmq-dashboard.desktop/config.json`
- macOS: `~/Library/Application Support/com.rocketmq-dashboard.desktop/config.json`
