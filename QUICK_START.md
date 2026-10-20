# 🚀 快速启动指南

## 当前状态

✅ **应用已启动**  
🌐 **前端地址**: http://localhost:1420/  
⚙️ **后端**: Rust (rocketmq-dashboard.exe)  
📦 **版本**: v0.3.0-alpha

---

## 访问应用

应用已经在桌面窗口中打开，你也可以通过浏览器访问：

```
http://localhost:1420/
```

---

## 测试连接

1. 在应用中输入 NameServer 地址：
   ```
   192.168.153.149:9876
   ```

2. 点击"连接"按钮

3. 等待连接成功提示

4. 开始使用各项功能！

---

## 功能菜单

### 📊 Dashboard
- 点击侧边栏"Dashboard"
- 查看集群概览

### 🖥️ Cluster
- 点击侧边栏"Cluster"
- 查看 Broker 列表
- 查看集群拓扑

### 📝 Topics
- 点击侧边栏"Topics"
- 查看所有 Topic
- 搜索 Topic

### 👥 Consumers
- 点击侧边栏"Consumers"
- 查看消费者组列表
- 选择一个组查看详情：
  - 在线实例
  - 消费进度
  - 堆积量统计

---

## 开发模式命令

### 启动应用
```bash
npm run tauri dev
```

### 停止应用
按 `Ctrl+C` 或关闭窗口

### 重新启动
```bash
# 停止当前应用（Ctrl+C）
# 然后重新运行
npm run tauri dev
```

### 查看日志
- 前端日志：浏览器 DevTools (F12)
- 后端日志：终端输出

---

## 常见问题

### Q: 连接失败怎么办？
A: 检查：
1. NameServer 地址是否正确
2. RocketMQ 服务是否运行
3. 网络是否连通（ping 测试）
4. 防火墙是否阻止连接

### Q: 看不到 Consumer 数据？
A: 可能原因：
1. 协议需要连接 Broker（而非 NameServer）
2. 当前版本可能需要进一步调整
3. 查看终端日志确认错误信息

### Q: 如何查看详细错误信息？
A: 
1. 前端错误：按 F12 打开 DevTools → Console
2. 后端错误：查看终端输出
3. 网络请求：DevTools → Network

### Q: 修改代码后如何生效？
A:
- 前端代码：自动热重载
- Rust 代码：自动重新编译（需要等待）

---

## 下一步

1. ✅ 测试连接功能
2. ✅ 查看 Cluster 信息
3. ✅ 查看 Topics 列表
4. 🆕 测试 Consumers 功能
5. 📝 报告问题或建议

---

## 获取帮助

- 📖 完整文档：[README.md](README.md)
- 🛠️ 开发进度：[PROGRESS.md](PROGRESS.md)
- ✅ 测试清单：[TEST_CHECKLIST.md](TEST_CHECKLIST.md)
- 📚 文档导航：[DOCS_INDEX.md](DOCS_INDEX.md)

---

<div align="center">

**祝你使用愉快！🎉**

Made with ❤️ by Kiro (AI)

</div>
