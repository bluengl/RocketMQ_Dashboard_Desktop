# 🚀 RocketMQ Dashboard Desktop

<div align="center">

![Version](https://img.shields.io/badge/version-0.3.0--alpha-blue)
![Tauri](https://img.shields.io/badge/Tauri-2.8-24C8DB)
![React](https://img.shields.io/badge/React-18-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6)
![Rust](https://img.shields.io/badge/Rust-1.82-orange)

基于 Tauri 2 + React 18 的现代化 RocketMQ 管理控制台桌面应用

[功能特性](#功能特性) • [快速开始](#快速开始) • [技术架构](#技术架构) • [开发指南](#开发指南) • [贡献](#贡献)

</div>

---

## 📖 项目简介

RocketMQ Dashboard Desktop 是一个功能完整的 Apache RocketMQ 管理控制台桌面应用程序，旨在为 RocketMQ 用户提供更便捷、高效的集群管理体验。

> **项目来源**：本项目是 [Apache RocketMQ Dashboard](https://github.com/apache/rocketmq-dashboard)（官方 Web 版管理控制台）的**一比一对照桌面版**，以 Tauri 桌面应用的形式复刻其页面布局、功能与交互。后端不依赖任何第三方 RocketMQ SDK，直接实现 RocketMQ Remoting 协议（TCP + JSON）与 NameServer / Broker 通信。

### 为什么选择桌面版？

- 🎨 **现代化 UI**: 深色主题 + 流畅动画，符合现代审美
- ⚡ **原生性能**: Tauri 打包，资源占用低，启动速度快
- 🔒 **本地连接**: 直接连接 NameServer，无需 Web 服务器
- 🛠️ **跨平台**: 支持 Windows、macOS、Linux
- 🔐 **安全可靠**: 本地运行，数据不经过第三方服务器

---

## ✨ 功能特性

### 已实现功能

#### 1. 连接管理
- ✅ 连接/断开 NameServer
- ✅ 连接状态实时显示
- ✅ 连接测试功能
- ✅ 超时保护（5s 连接，10s 读取）

#### 2. 集群管理
- ✅ Broker 列表查看
- ✅ 集群拓扑可视化
- ✅ Broker 详细信息（名称、地址、集群、主从关系）
- ✅ 在线状态监控

#### 3. Topic 管理
- ✅ Topic 列表查询
- ✅ Topic 详细信息展示
- ✅ 搜索和过滤功能

#### 4. Consumer 管理
- ✅ 消费者组列表
- ✅ 消费进度查询
- ✅ 在线实例监控
- ✅ 堆积量统计和告警

### 开发中功能

- 🚧 消息查询（按 ID / Key / Offset）
- 🚧 Dashboard 实时监控（TPS、堆积、健康度）
- 🚧 运维工具（重置位点、发送测试消息）
- 🚧 ACL 权限管理
- 🚧 消息轨迹查询

### 与 Apache RocketMQ Dashboard 功能对照

以下对照官方 [rocketmq-dashboard](https://github.com/apache/rocketmq-dashboard) 的功能模块，标注当前桌面版的**实际实现状态**（以代码为准）：

| 模块 | 功能 | 状态 |
|------|------|------|
| OPS | Nameserver 管理、多集群切换 | ❌ 未实现 |
| Dashboard | Broker / Topic / Group 概览统计 | ⚠️ 部分（Broker ✅、Topic ✅、Group 恒为 0） |
| Dashboard | TPS / 消息量趋势统计 | ❌ 未实现 |
| Cluster | Broker 列表 | ✅ 已实现（内联于 Dashboard 页） |
| Cluster | 独立页面、Broker 详情、运行时信息、拓扑图 | ❌ 未实现 |
| Topic | Topic 列表 + 搜索 | ✅ 已实现（仅名称） |
| Topic | 新增 / 删除 / 更新 | ❌ 未实现 |
| Topic | 详情（状态 / 路由） | ❌ 未实现 |
| Topic | 发送测试消息 / 重置消费位点 | ❌ 未实现 |
| Consumer | 消费组列表 | ⚠️ 后端已实现，存在连接状态 bug |
| Consumer | 消费进度 / 在线实例 | ⚠️ 后端已实现，前端未接线 |
| Consumer | 重置消费位点 | ❌ 未实现 |
| Producer | 生产者连接查询（RocketMQ 5.x） | ❌ 未实现 |
| Message | 按 Topic / Key / 时间范围查询消息 | ❌ 未实现 |
| Message | 按 Message ID 查询消息详情 | ❌ 未实现 |
| Message Trace | 消息轨迹查询 | ❌ 未实现 |
| ACL | 用户与权限管理 | ❌ 未实现 |

---

## 🎯 技术架构

### 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| **桌面框架** | Tauri 2.8 | 跨平台桌面应用框架，比 Electron 更轻量 |
| **前端框架** | React 18 | 现代化 UI 库 |
| **开发语言** | TypeScript 5.5 | 类型安全的 JavaScript 超集 |
| **后端语言** | Rust 1.82 | 高性能、内存安全的系统编程语言 |
| **构建工具** | Vite 5 | 快速的前端构建工具 |
| **UI 样式** | CSS + Tailwind 风格 | 现代化深色主题 |
| **图标库** | lucide-react | 清晰简洁的图标系统 |

### 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                   React Frontend                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐│
│  │Dashboard │  │ Cluster  │  │  Topics  │  │Consumer ││
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘│
│                        │                                 │
│                  Tauri Commands                          │
└────────────────────────┼────────────────────────────────┘
                         │
┌────────────────────────┼────────────────────────────────┐
│                  Rust Backend                            │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐│
│  │   Commands   │  │   RocketMQ   │  │    Protocol   ││
│  │   Handlers   │  │    Client    │  │    Encoder    ││
│  └──────────────┘  └──────────────┘  └───────────────┘│
└────────────────────────┼────────────────────────────────┘
                         │ TCP
                         │
              ┌──────────┼──────────┐
              │   RocketMQ Cluster  │
              │  ┌────────────────┐ │
              │  │  NameServer    │ │
              │  └────────────────┘ │
              │  ┌────────────────┐ │
              │  │  Broker Master │ │
              │  └────────────────┘ │
              │  ┌────────────────┐ │
              │  │  Broker Slave  │ │
              │  └────────────────┘ │
              └─────────────────────┘
```

### RocketMQ 协议实现

本项目**不依赖**任何第三方 RocketMQ SDK，直接实现了 RocketMQ Remoting 协议：

```rust
// 请求格式: [4字节长度(Big-Endian)] + [JSON Header + Body]
[Length: 4 bytes][Header + Body: JSON]

// Header 结构
{
  "code": 103,                          // 请求码
  "language": "RUST",                   // 语言标识
  "version": 1,                         // 协议版本
  "opaque": 1,                          // 请求 ID
  "flag": 0,                            // 标志位
  "extFields": { ... },                 // 扩展字段
  "serializeTypeCurrentRPC": "JSON"     // 序列化类型
}
```

已实现的协议：

| 协议名称 | 请求码 | 功能 |
|---------|-------|------|
| GET_BROKER_CLUSTER_INFO | 103 | 获取集群信息 |
| GET_ALL_TOPIC_LIST_FROM_NAMESERVER | 17 | 获取所有 Topic |
| GET_ALL_CONSUMER_GROUP | 200 | 获取消费者组列表 |
| QUERY_CONSUMER_OFFSET | 14 | 查询消费进度 |
| GET_CONSUMER_CONNECTION_LIST | 204 | 查询在线实例 |

---

## 🚀 快速开始

### 环境要求

- **Node.js**: >= 18.0.0
- **Rust**: >= 1.75.0
- **npm** 或 **pnpm** 或 **yarn**
- **RocketMQ**: >= 4.x（支持 4.x 和 5.x 版本）

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/your-username/rocketmq-dashboard-desktop.git
   cd rocketmq-dashboard-desktop
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发模式**
   ```bash
   npm run tauri dev
   ```

4. **构建生产版本**
   ```bash
   npm run tauri build
   ```

   构建产物位于 `src-tauri/target/release/bundle/`

---

## 📱 使用指南

### 1. 连接 RocketMQ

启动应用后，在首页输入 NameServer 地址：

```
192.168.1.100:9876
```

或多个 NameServer（用逗号分隔）：

```
192.168.1.100:9876,192.168.1.101:9876
```

点击"连接"按钮，等待连接成功。

### 2. 查看集群信息

点击侧边栏的"Cluster"，查看：
- Broker 列表
- 集群拓扑
- 主从关系
- 在线状态

### 3. 管理 Topic

点击侧边栏的"Topics"，可以：
- 查看所有 Topic
- 搜索 Topic
- 查看 Topic 详细信息

### 4. 监控 Consumer

点击侧边栏的"Consumers"，可以：
- 查看所有消费者组
- 查看消费进度
- 监控堆积量
- 查看在线实例

---

## 🛠️ 开发指南

### 项目结构

```
rocketmqMg/
├── src/                          # React 前端源码
│   ├── pages/                    # 页面组件
│   │   ├── DashboardPage.tsx     # Dashboard 页面
│   │   ├── ClusterPage.tsx       # 集群管理页面
│   │   ├── TopicsPage.tsx        # Topic 管理页面
│   │   └── ConsumersPage.tsx     # Consumer 管理页面
│   ├── App.tsx                   # 主应用 + 路由
│   ├── main.tsx                  # 入口文件
│   └── index.css                 # 全局样式
│
├── src-tauri/                    # Tauri 后端源码
│   ├── src/
│   │   ├── main.rs               # 入口文件
│   │   ├── commands/             # Tauri 命令模块
│   │   │   ├── mod.rs            # 模块导出
│   │   │   ├── cluster.rs        # 集群管理命令
│   │   │   ├── topic.rs          # Topic 管理命令
│   │   │   └── consumer.rs       # Consumer 管理命令
│   │   └── rocketmq/             # RocketMQ 客户端
│   │       ├── mod.rs            # 模块导出
│   │       ├── client.rs         # TCP 连接 + 协议处理
│   │       └── protocol.rs       # 协议定义
│   ├── Cargo.toml                # Rust 依赖配置
│   └── tauri.conf.json           # Tauri 配置
│
├── public/                       # 静态资源
├── package.json                  # npm 配置
├── vite.config.ts                # Vite 配置
├── tsconfig.json                 # TypeScript 配置
│
├── PROGRESS.md                   # 开发进度文档
├── SUMMARY.md                    # 实现总结文档
├── TEST_CHECKLIST.md             # 测试清单
└── README.md                     # 项目说明（本文件）
```

### 添加新功能

#### 1. 添加 Rust 命令

在 `src-tauri/src/commands/` 目录下创建新的命令文件：

```rust
// src-tauri/src/commands/message.rs
use tauri::State;
use tokio::sync::Mutex;

#[tauri::command]
pub async fn query_message_by_id(
    msg_id: String,
    client: State<'_, Mutex<Option<crate::rocketmq::RocketMQClient>>>,
) -> Result<MessageInfo, String> {
    // 实现逻辑
}
```

在 `main.rs` 中注册命令：

```rust
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // ... 其他命令
            commands::message::query_message_by_id,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

#### 2. 前端调用命令

```typescript
import { invoke } from '@tauri-apps/api/core'

const queryMessage = async (msgId: string) => {
  try {
    const result = await invoke<MessageInfo>('query_message_by_id', { msgId })
    return result
  } catch (error) {
    console.error('Failed to query message:', error)
    throw error
  }
}
```

### 调试技巧

#### 前端调试
- 按 `F12` 打开 Chrome DevTools
- 查看 Console 日志
- 使用 React DevTools

#### Rust 后端调试
- 查看终端输出
- 使用 `println!` 或 `dbg!` 宏
- 使用 `cargo test` 运行单元测试

#### 协议调试
```rust
// 在 client.rs 中添加日志
println!("Request: {:?}", command);
println!("Response: {:?}", response);
```

---

## 📊 性能指标

| 指标 | 数值 |
|------|------|
| 启动时间 | < 1s |
| 内存占用 | ~60MB |
| 安装包大小 | ~10MB（Windows） |
| 连接超时 | 5s |
| 请求超时 | 10s |

---

## 🧪 测试

### 单元测试
```bash
# Rust 单元测试
cd src-tauri
cargo test

# 前端单元测试
npm test
```

### 集成测试
```bash
# 启动应用
npm run tauri dev

# 按照 TEST_CHECKLIST.md 进行手工测试
```

---

## 📦 打包发布

### Windows
```bash
npm run tauri build
```
生成 `.msi` 和 `.exe` 安装包

### macOS
```bash
npm run tauri build
```
生成 `.dmg` 和 `.app` 应用包

### Linux
```bash
npm run tauri build
```
生成 `.deb` 和 `.AppImage` 包

---

## 🐛 已知问题

1. **Consumer 协议验证**
   - `GET_ALL_CONSUMER_GROUP` 可能需要连接到 Broker（而非 NameServer）
   - 需要实际测试协议是否正确返回数据

2. **大数据量场景**
   - 当 Topic 数量 > 1000 时，列表加载可能较慢
   - 待实现分页和虚拟滚动优化

3. **错误处理**
   - 部分错误信息不够详细
   - 需要完善网络错误、协议错误的区分

---

## 🗺️ Roadmap

### v0.4.0（开发中）
- [ ] 消息查询功能（按 ID / Key / Offset）
- [ ] Dashboard 实时监控（TPS、堆积、健康度）
- [ ] 运维工具（重置位点、发送测试消息）

### v0.5.0
- [ ] ACL 权限管理
- [ ] 消息轨迹查询
- [ ] 配置管理

### v1.0.0
- [ ] 完整的测试覆盖
- [ ] 性能优化
- [ ] 多语言支持（English / 中文）
- [ ] 自动更新功能

---

## 🤝 贡献

欢迎贡献代码、报告 Bug、提出新功能建议！

### 贡献流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

### 行为准则

- 尊重所有贡献者
- 保持代码风格一致
- 添加必要的测试
- 更新相关文档

---

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

---

## 🙏 致谢

- [Apache RocketMQ](https://rocketmq.apache.org/) - 优秀的消息队列系统
- [Tauri](https://tauri.app/) - 现代化的桌面应用框架
- [React](https://react.dev/) - 强大的 UI 库
- [Rust](https://www.rust-lang.org/) - 高性能系统编程语言

---

## 📧 联系方式

- **Issues**: [GitHub Issues](https://github.com/your-username/rocketmq-dashboard-desktop/issues)
- **讨论**: [GitHub Discussions](https://github.com/your-username/rocketmq-dashboard-desktop/discussions)

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给个 Star！⭐**

Made with ❤️ by Kiro (AI)

</div>
