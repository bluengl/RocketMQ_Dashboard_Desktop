# 🚀 RocketMQ Dashboard 桌面版

基于 Tauri 2 + React 18 的现代化 Apache RocketMQ 管理控制台

![Version](https://img.shields.io/badge/版本-0.3.0--alpha-blue)
![Tauri](https://img.shields.io/badge/Tauri-2.8-24C8DB)
![React](https://img.shields.io/badge/React-18-61DAFB)
![Rust](https://img.shields.io/badge/Rust-1.82-orange)

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
- **连接管理** - 连接/断开 NameServer
- **集群管理** - 查看 Broker 拓扑、状态监控
- **Topic 管理** - Topic 列表、详情查看
- **Consumer 管理** - 消费者组、进度、堆积监控

### 🚧 开发中
- 消息查询（ID / Key / Offset）
- 实时监控（TPS / 堆积 / 健康度）
- 运维工具（重置位点 / 发送消息）
- ACL 权限管理
- 消息轨迹

### 与 rocketmq-dashboard 功能对照

对照官方 [rocketmq-dashboard](https://github.com/apache/rocketmq-dashboard)，当前桌面版的实际实现状态：

| 模块 | 状态 | 说明 |
|------|------|------|
| OPS | ❌ | Nameserver 管理、多集群切换 |
| Dashboard | ⚠️ | 仅 Broker/Topic 数，Group 恒为 0，无 TPS 趋势 |
| Cluster | ⚠️ | Broker 列表内联于 Dashboard，无独立页/详情/拓扑 |
| Topic | ⚠️ | 仅名称列表 + 搜索，无新增/删除/详情/路由 |
| Consumer | ⚠️ | 后端命令已有，存在连接状态 bug、前端未接线 |
| Producer | ❌ | 生产者连接查询 |
| Message | ❌ | 按 Topic/Key/ID/时间查询 |
| Message Trace | ❌ | 消息轨迹 |
| ACL | ❌ | 用户与权限管理 |

---

## 🚀 快速开始

### 环境要求
- Node.js >= 18
- Rust >= 1.75
- RocketMQ >= 4.x

### 安装
```bash
# 克隆项目
git clone https://github.com/your-username/rocketmq-dashboard-desktop.git
cd rocketmq-dashboard-desktop

# 安装依赖
npm install

# 启动开发模式
npm run tauri dev

# 构建生产版本
npm run tauri build
```

---

## 📱 使用

1. **连接集群**
   - 输入 NameServer 地址（如 `192.168.1.100:9876`）
   - 点击"连接"按钮

2. **查看集群**
   - 点击"Cluster"查看 Broker 信息

3. **管理 Topic**
   - 点击"Topics"查看所有主题

4. **监控 Consumer**
   - 点击"Consumers"查看消费进度

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri 2.8 |
| 前端 | React 18 + TypeScript |
| 后端 | Rust 1.82 |
| 构建 | Vite 5 |
| 图标 | lucide-react |

---

## 📂 项目结构

```
rocketmqMg/
├── src/                    # React 前端
│   ├── pages/              # 页面组件
│   └── App.tsx             # 主应用
├── src-tauri/              # Rust 后端
│   ├── commands/           # Tauri 命令
│   └── rocketmq/           # RocketMQ 客户端
├── PROGRESS.md             # 开发进度
├── SUMMARY.md              # 实现总结
└── README.md               # 项目说明
```

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

MIT License

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
