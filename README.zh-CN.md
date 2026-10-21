# 🚀 RocketMQ Dashboard 桌面版

基于 Tauri 2 + React 18 的现代化 Apache RocketMQ 管理控制台

![Version](https://img.shields.io/badge/版本-0.3.0--alpha-blue)
![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB)
![React](https://img.shields.io/badge/React-18-61DAFB)
![Rust](https://img.shields.io/badge/Rust-stable-orange)

[English](README.md) | 简体中文

---

## 📖 简介

一个功能完整、高性能的 RocketMQ 桌面管理工具，提供直观的可视化界面和便捷的运维操作。

> **项目来源**：本项目是 [Apache RocketMQ Dashboard](https://github.com/apache/rocketmq-dashboard)（官方 Web 版管理控制台）的**一比一对照桌面版**，用 Tauri 桌面应用复刻其页面、功能与交互；后端不依赖第三方 RocketMQ SDK，直接实现 RocketMQ Remoting 协议。

### ✨ 特点

- 🎨 **现代化界面** - 深色主题，流畅动画
- ⚡ **原生性能** - Tauri 打包，资源占用低
- 🔒 **直接连接** - 无需额外的 Web 服务
- 🛠️ **跨平台** - Windows / macOS / Linux
- 🔐 **安全可靠** - 本地运行，数据安全

---

## 🎯 功能

### ✅ 已完成
- **连接管理** - 连接/断开 NameServer，可选 ACL 凭据
- **集群管理** - Broker 拓扑、运行时信息、Produce/Consume TPS 趋势
- **Topic 管理** - 列表、路由、状态、新建、更新配置、删除、发送测试消息
- **Consumer 管理** - 消费组、逐队列进度、在线实例、重置位点、消费 TPS
- **消息查询** - Message ID / Key / Topic + 时间范围
- **消息轨迹** - Pub / SubAfter / EndTransaction / Recall 时间轴（需开启 trace）
- **Producer 查询** - 生产者组与在线连接
- **ACL** - ACL 2.0 用户与规则 CRUD（需开启 ACL）

### 🚧 开发中
- 清理过期消息等额外运维工具
- 安装包在目标平台上的完整验证

### 与 rocketmq-dashboard 功能对照

对照官方 [rocketmq-dashboard](https://github.com/apache/rocketmq-dashboard)，当前桌面版的实际实现状态：

| 模块 | 状态 | 说明 |
|------|------|------|
| OPS | ✅ | Nameserver 管理、多集群切换 |
| Dashboard | ✅ | 概览指标 + TPS 趋势图 |
| Cluster | ✅ | 独立页面、运行时信息、拓扑 |
| Topic | ✅ | 列表、路由、状态、新建、更新配置、删除、发送测试消息 |
| Consumer | ✅ | 组列表、进度、在线实例、重置位点 |
| Producer | ✅ | 生产者组与在线连接 |
| Message | ✅ | 按 Topic/Key/ID/时间查询 |
| Message Trace | ✅ | 需 Broker 开启 trace |
| ACL | ✅ | 需 Broker 开启 ACL |

---

## 🚀 快速开始

### 环境要求
- Node.js >= 18
- Rust >= 1.75
- RocketMQ >= 4.x

### 安装
```bash
# 克隆项目
git clone <repository-url>
cd rocketmq-dashboard-desktop

# 安装依赖
npm install

# 启动开发模式
npm run dev

# 构建前端
npm run build

# 构建桌面安装包
npm run build:desktop
```

## 📦 打包发布

安装包需在对应操作系统上构建（Windows / macOS / Linux），产物位于 `src-tauri/target/release/bundle/`。推送 `v*` 标签会触发 `.github/workflows/release.yml`，在三个平台上构建并创建 GitHub Draft Release。

---

## 📱 使用

1. **连接集群**
   - 输入 NameServer 地址（如 `192.168.1.100:9876`，多个地址用逗号分隔）
   - 下拉框会列出最近成功连接过的地址，可直接选择或删除
   - 点击“连接”按钮

2. **查看集群**
   - 点击"Cluster"查看 Broker 信息

3. **管理 Topic**
   - 点击"Topics"查看所有主题
   - 查看路由与逐队列状态，更新读写队列数和权限
   - 发送测试消息（Tag / Key / 队列 / Broker 可选）

4. **监控 Consumer**
   - 点击"Consumers"查看消费进度

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri 2 |
| 前端 | React 18 + TypeScript |
| 后端 | Rust（stable） |
| 构建 | Vite 5 |
| 样式 | Tailwind CSS v4 + 自定义 CSS |
| 图标 | lucide-react |

---

## 📂 项目结构

```
rocketmqMg/
├── src/                    # React 前端
│   ├── App.tsx             # 主应用（导航 / 连接 / 标题栏）
│   ├── *Page.tsx           # 各功能页面
│   ├── components/         # Select、ComboBox、DateTimePicker 等通用组件
│   ├── utils/ hooks/ types/
│   └── i18n.tsx            # 中英文文案
├── src-tauri/              # Rust 后端
│   ├── src/commands/       # Tauri 命令
│   └── src/rocketmq/       # RocketMQ 客户端与协议
└── README.md / README.zh-CN.md
```

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

[Apache License 2.0](LICENSE)。

本项目是 [Apache RocketMQ Dashboard](https://github.com/apache/rocketmq-dashboard) 的对照实现，保留上游项目的版权与许可声明，详见 [NOTICE](NOTICE)。

---

## 🙏 致谢

- [Apache RocketMQ](https://rocketmq.apache.org/)
- [Tauri](https://tauri.app/)
- [React](https://react.dev/)

---

<div align="center">

**如果喜欢，请给个 ⭐ Star！**

Made with ❤️ by Kiro (AI)

</div>
