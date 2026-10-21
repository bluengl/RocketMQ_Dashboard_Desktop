# 🚀 RocketMQ Dashboard Desktop

<div align="center">

![Version](https://img.shields.io/badge/version-0.3.0--alpha-blue)
![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB)
![React](https://img.shields.io/badge/React-18-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6)
![Rust](https://img.shields.io/badge/Rust-stable-orange)

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
- ✅ 连接/断开 NameServer（支持逗号分隔的多个地址）
- ✅ 连接状态实时显示
- ✅ 连接历史记录（仅保存连接成功的地址，自动去重，可手动删除）
- ✅ 连接时自动验证 NameServer 可达性
- ✅ 超时保护（5s 连接，10s 读取）

#### 2. 集群管理
- ✅ Broker 列表查看
- ✅ 集群拓扑可视化
- ✅ Broker 详细信息（名称、地址、集群、主从关系）
- ✅ 在线状态监控

#### 3. Topic 管理
- ✅ Topic 列表查询
- ✅ Topic 路由查看
- ✅ 新建 / 删除 / 更新 Topic 配置
- ✅ Topic 状态（逐 Broker / 队列 offset 与消息量）
- ✅ 发送测试消息（Tag / Key / 指定队列 / 指定 Broker）
- ✅ 搜索和过滤功能

#### 4. Consumer 管理
- ✅ 消费者组列表
- ✅ 消费进度查询（逐队列 offset / lag）
- ✅ 在线实例监控（203 + 连接列表）
- ✅ 重置消费位点（最新 / 最早 / 指定值）
- ✅ 消费 TPS 采样

#### 5. 消息与轨迹
- ✅ 按 Message ID / Key / Topic + 时间范围查询消息
- ✅ 消息轨迹（Pub / SubAfter / EndTransaction / Recall 时间轴，需 `traceTopicEnable=true`）

#### 6. Producer 查询
- ✅ 生产者组枚举
- ✅ 在线生产者连接（可按 Topic 缩小 Broker 范围）

#### 7. Dashboard / Cluster / ACL
- ✅ Broker 运行时指标、Produce/Consume TPS 趋势图、集群拓扑
- ✅ ACL 2.0 用户与规则 CRUD（需 Broker 开启 ACL；连接栏可配置 Access Key / Secret Key）

### 开发中功能

- 🚧 额外运维工具（清理过期消息）
- 🚧 安装包在目标平台上的完整验证

### 与 Apache RocketMQ Dashboard 功能对照

以下对照官方 [rocketmq-dashboard](https://github.com/apache/rocketmq-dashboard) 的功能模块，标注当前桌面版的**实际实现状态**（以代码为准）：

| 模块 | 功能 | 状态 |
|------|------|------|
| OPS | Nameserver 管理、多集群切换 | ✅ 已实现 |
| Dashboard | Broker / Topic / Group 概览统计 | ✅ 已实现 |
| Dashboard | TPS / 消息量趋势统计 | ✅ 已实现（5s 采样，支持按次数 / 时间范围查看） |
| Cluster | Broker 列表 | ✅ 已实现 |
| Cluster | 独立页面、Broker 详情、运行时信息、拓扑图 | ✅ 已实现 |
| Topic | Topic 列表 + 搜索 | ✅ 已实现 |
| Topic | 新增 / 删除 / 更新配置 / 路由查看 | ✅ 已实现 |
| Topic | 详情（状态 / 路由） | ✅ 已实现（状态含逐队列 min/max offset） |
| Topic | 发送测试消息 | ✅ 已实现 |
| Consumer | 消费组列表 | ✅ 已实现 |
| Consumer | 消费进度 / 在线实例 | ✅ 已实现 |
| Consumer | 重置消费位点 | ✅ 已实现 |
| Producer | 生产者连接查询（RocketMQ 5.x） | ✅ 已实现 |
| Message | 按 Topic / Key / 时间范围查询消息 | ✅ 已实现 |
| Message | 按 Message ID 查询消息详情 | ✅ 已实现 |
| Message Trace | 消息轨迹查询 | ✅ 已实现（需 Broker 开启 trace） |
| ACL | 用户与权限管理 | ✅ 已实现（需 Broker 开启 ACL） |

---

## 🎯 技术架构

### 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| **桌面框架** | Tauri 2 | 跨平台桌面应用框架，比 Electron 更轻量 |
| **前端框架** | React 18 | 现代化 UI 库 |
| **开发语言** | TypeScript 5.7 | 类型安全的 JavaScript 超集 |
| **后端语言** | Rust（stable） | 高性能、内存安全的系统编程语言 |
| **构建工具** | Vite 5 | 快速的前端构建工具 |
| **UI 样式** | Tailwind CSS v4 + 自定义 CSS | 现代化深色 / 浅色主题 |
| **图标库** | lucide-react | 清晰简洁的图标系统 |
| **图表** | Recharts | TPS 趋势图 |

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
  "code": 106,                          // 请求码
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
| GET_ROUTEINFO_BY_TOPIC | 105 | 获取 Topic 路由 |
| GET_BROKER_CLUSTER_INFO | 106 | 获取集群信息 |
| GET_ALL_TOPIC_LIST_FROM_NAMESERVER | 206 | 获取所有 Topic |
| UPDATE_AND_CREATE_TOPIC | 17 | 新建 / 更新 Topic 配置 |
| DELETE_TOPIC_IN_NAMESRV / BROKER | 216 / 215 | 删除 Topic |
| GET_MIN_OFFSET / GET_MAX_OFFSET | 31 / 30 | 队列最早 / 最新位点（Topic 状态、消费 lag） |
| SEND_MESSAGE_V2 / SEND_MESSAGE | 310 / 10 | 发送测试消息（旧 Broker 自动回退到 10） |
| QUERY_MESSAGE | 12 | 按 Key 查询消息 |
| PULL_MESSAGE | 11 | 按时间范围拉取消息（逐队列拉取） |
| VIEW_MESSAGE_BY_ID | 33 | 按消息 ID 查看单条消息 |
| GET_ALL_SUBSCRIPTIONGROUP_CONFIG | 201 | 获取消费者组列表 |
| QUERY_CONSUMER_OFFSET | 14 | 查询消费进度 |
| UPDATE_CONSUMER_OFFSET | 15 | 重置消费位点 |
| GET_CONSUMER_CONNECTION_LIST | 203 | 查询消费者在线实例 |
| GET_PRODUCER_CONNECTION_LIST / GET_ALL_PRODUCER_INFO | 204 / 328 | 生产者连接 / 生产者组 |
| GET_BROKER_RUNTIME_INFO | 28 | Broker 运行时信息 |
| AUTH_* (ACL 2.0) | 3001–3010 | 用户与规则 CRUD |

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
   git clone <repository-url>
   cd rocketmq-dashboard-desktop
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发模式**
   ```bash
   npm run dev
   ```

4. **构建前端 / 桌面安装包**
   ```bash
   npm run build            # 仅构建前端（输出到 dist/）
   npm run build:desktop    # 构建桌面安装包
   ```

   安装包位于 `src-tauri/target/release/bundle/`

---

## 📱 使用指南

### 1. 连接 RocketMQ

启动应用后，在顶部输入 NameServer 地址（下拉框会列出最近成功连接过的地址，可删除不需要的记录）：

```
192.168.1.100:9876
```

多个 NameServer 用逗号分隔：

```
192.168.1.100:9876,192.168.1.101:9876
```

点击“连接”按钮，连接成功后状态会实时显示。

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
- 查看 Topic 路由与状态（逐队列 min/max offset）
- 新建、更新配置（读写队列数 / 权限）、删除 Topic
- 发送测试消息（可选 Tag / Key / 队列 / Broker）

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
├── src/                            # React 前端
│   ├── App.tsx                     # 主应用：导航、连接、窗口标题栏
│   ├── main.tsx                    # 入口（I18nProvider）
│   ├── i18n.tsx                    # 中英文文案与语言切换
│   ├── DashboardPage.tsx           # 仪表盘（指标 / TPS 趋势）
│   ├── TopicsPage.tsx              # Topic 列表、路由、状态、增删改、发消息
│   ├── ConsumersPage.tsx           # 消费组、进度、连接、重置位点
│   ├── ProducerPage.tsx            # 生产者组与在线连接
│   ├── MessagePage.tsx             # 消息查询（ID / Key / 时间范围）
│   ├── TracePage.tsx               # 消息轨迹
│   ├── ClusterPage.tsx             # 集群拓扑、运行时信息
│   ├── AclPage.tsx                 # ACL 2.0 用户与规则
│   ├── OpsPage.tsx                 # NameServer Profile / 多集群切换
│   ├── components/                 # Select、ComboBox、DateTimePicker、
│   │                               # Pagination、LoadingMask、ErrorBoundary 等
│   ├── hooks/usePagination.ts
│   ├── utils/                      # errors、topics、clusterProfiles、nameServerHistory
│   ├── types/                      # 前后端共享类型
│   └── styles/                     # globals.css、monitor.css
│
├── src-tauri/                      # Rust 后端
│   ├── src/
│   │   ├── main.rs                 # 入口 + 命令注册
│   │   ├── commands/               # cluster / topic / consumer / message /
│   │   │                           # broker / acl / producer
│   │   └── rocketmq/               # client.rs（TCP + 编解码）、protocol.rs
│   ├── capabilities/default.json   # 窗口控制等权限
│   ├── icons/                      # 应用图标
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── public/                         # 静态资源
├── package.json / vite.config.ts / tsconfig.json
├── README.md / README.zh-CN.md / LICENSE
└── .github/workflows/release.yml   # 多平台构建与 Draft Release
```

### 添加新功能

#### 1. 添加 Rust 命令

在 `src-tauri/src/commands/` 目录下创建新的命令文件：

```rust
// src-tauri/src/commands/example.rs
use crate::rocketmq;

#[tauri::command]
pub async fn query_something(id: String) -> Result<String, String> {
    // 连接状态统一保存在 rocketmq::GLOBAL_CLIENT 中
    let global = rocketmq::GLOBAL_CLIENT.lock().await;
    let client = global.as_ref().ok_or("Not connected to RocketMQ")?;
    client.query_something(&id) // 具体协议逻辑写在 rocketmq/client.rs
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
- 开发模式下右键选择“检查”，或按 `Ctrl+Shift+I` 打开开发者工具
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

## 📊 性能参考

以下为本机测试环境的参考值，实际取决于机器与集群规模：

| 指标 | 参考值 |
|------|--------|
| 启动时间 | < 1s |
| 内存占用 | ~60MB |
| 安装包大小 | ~10MB（Windows） |
| 连接超时 | 5s |
| 请求超时 | 10s |

---

## 🧪 测试

### 单元测试
```bash
# Rust 单元测试（纯逻辑，不需要集群）
cargo test --manifest-path src-tauri/Cargo.toml

# 需要真实集群的集成测试（默认 #[ignore]，需先修改测试中的 NameServer 地址）
cargo test --manifest-path src-tauri/Cargo.toml -- --ignored
```

> 前端目前没有单元测试脚本，UI 通过 `npm run dev` 手工验证。

### 集成测试
```bash
# 启动应用
npm run dev
```

---

## 📦 打包发布

桌面安装包需在对应操作系统上构建（Tauri 不支持跨平台交叉打包）。

### 本机构建
```bash
npm ci
npm run build:desktop        # release build with installers
npm run build:desktop:debug  # debug build (faster, for verification)
```
产物位于 `src-tauri/target/release/bundle/`：
- Windows：`.msi`、`.exe`（NSIS）
- macOS：`.dmg`、`.app`
- Linux：`.deb`、`.AppImage`

### CI 发布
推送 `v*` 标签会触发 `.github/workflows/release.yml`，在 Windows、macOS（x64 + arm64）和 Ubuntu 上构建，并创建一个 GitHub Draft Release。

---

## 🐛 已知问题

1. **大数据量场景**
   - Topic 列表已支持分页，但未做虚拟滚动
   - Topic 状态需逐队列查询 min/max offset，1000+ 队列时耗时数秒

2. **错误处理**
   - 部分错误信息不够详细
   - 需要完善网络错误、协议错误的区分

---

## 🗺️ Roadmap

### 后续
- [ ] 清理过期消息等额外运维工具
- [ ] 安装包在 Windows / macOS / Linux 上的安装与启动验证
- [ ] 在开启 `traceTopicEnable` / ACL 的 Broker 上完成 trace 与 ACL 端到端复验
- [ ] 大数据量场景的虚拟滚动优化
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

## 📧 反馈

- 通过仓库的 Issues 报告 Bug 或提出建议
- 通过 Discussions 参与讨论

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给个 Star！⭐**

Made with ❤️ by Kiro (AI)

</div>
